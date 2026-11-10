const { DailyDaybook, Transaction, Category, Vendor } = require('../models');
const { Op } = require('sequelize');
const { ValidationError, NotFoundError } = require('../utils/AppError');
const fuelRateService = require('./fuelRateService');

const N = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Get daybook for a given date.
 * If not exists, pre-fills with previous day's closing meters, dips, and dealer margins directly from the DB.
 */
const getByDate = async (date) => {
  if (!date) throw new ValidationError('Date is required');

  const existing = await DailyDaybook.findOne({
    where: { entry_date: date },
    include: [
      { association: 'creator', attributes: ['id', 'username', 'role'] },
      { association: 'updater', attributes: ['id', 'username', 'role'] },
    ],
  });

  if (existing) {
    return { is_new: false, entry: existing };
  }

  // Pre-fill from latest previous day stored in database
  const latestPrev = await DailyDaybook.findOne({
    where: { entry_date: { [Op.lt]: date } },
    order: [['entry_date', 'DESC']],
  });

  // Fetch active fuel rates (with live OMC auto-fetch if available)
  const latestRates = await fuelRateService.getLatestRates().catch(() => null);
  const activeMsPrice = latestRates?.ms_price || (latestPrev ? latestPrev.ms_price : 104.50);
  const activeHsdPrice = latestRates?.hsd_price || (latestPrev ? latestPrev.hsd_price : 91.20);

  // Margins loaded directly from previous DB record (defaulting to 3.50/3.00 if brand new database)
  const activeMsMargin = latestPrev ? N(latestPrev.ms_margin) : 3.50;
  const activeHsdMargin = latestPrev ? N(latestPrev.hsd_margin) : 3.00;

  return {
    is_new: true,
    entry: {
      entry_date: date,
      ms_price: activeMsPrice,
      ms_open: latestPrev ? latestPrev.ms_close : 0,
      ms_close: '',
      ms_sold: 0,
      ms_amount: 0,
      ms_dip_open: '',
      ms_dip_close: '',
      ms_dip_diff: 0,
      ms_margin: activeMsMargin,

      hsd_price: activeHsdPrice,
      hsd_open: latestPrev ? latestPrev.hsd_close : 0,
      hsd_close: '',
      hsd_sold: 0,
      hsd_amount: 0,
      hsd_dip_open: '',
      hsd_dip_close: '',
      hsd_dip_diff: 0,
      hsd_margin: activeHsdMargin,

      total_sales: 0,
      cash_collected: '',
      upi_collected: '',
      card_collected: '',
      credit_collected: '',
      total_collected: 0,
      short_excess: 0,
      total_margin: 0,

      expenses: [],
      day_expenses: 0,
      net_amount: 0,
      net_profit: 0,
      notes: '',
    },
  };
};

/**
 * Save / Upsert a daily daybook sheet.
 * Always recalculates math on the server to prevent tamper.
 * Auto-syncs shift petty cash expenses into the central unified transactions (Day Book) table.
 */
const saveDay = async (data, userId) => {
  const date = data.entry_date;
  if (!date) throw new ValidationError('Date is required');

  // Math recalculation
  const msPrice = N(data.ms_price) || 104.50;
  const msOpen  = N(data.ms_open);
  const msClose = N(data.ms_close);
  const msSold  = Math.max(0, msClose - msOpen);
  const msAmt   = parseFloat((msSold * msPrice).toFixed(2));
  const msDipO  = data.ms_dip_open !== '' && data.ms_dip_open !== null ? N(data.ms_dip_open) : null;
  const msDipC  = data.ms_dip_close !== '' && data.ms_dip_close !== null ? N(data.ms_dip_close) : null;
  const msDipDiff = msDipO !== null && msDipC !== null ? parseFloat((msDipO - msDipC).toFixed(2)) : 0;
  const msMargin = data.ms_margin !== undefined && data.ms_margin !== null && data.ms_margin !== '' ? N(data.ms_margin) : 3.50;

  const hsdPrice = N(data.hsd_price) || 91.20;
  const hsdOpen  = N(data.hsd_open);
  const hsdClose = N(data.hsd_close);
  const hsdSold  = Math.max(0, hsdClose - hsdOpen);
  const hsdAmt   = parseFloat((hsdSold * hsdPrice).toFixed(2));
  const hsdDipO  = data.hsd_dip_open !== '' && data.hsd_dip_open !== null ? N(data.hsd_dip_open) : null;
  const hsdDipC  = data.hsd_dip_close !== '' && data.hsd_dip_close !== null ? N(data.hsd_dip_close) : null;
  const hsdDipDiff = hsdDipO !== null && hsdDipC !== null ? parseFloat((hsdDipO - hsdDipC).toFixed(2)) : 0;
  const hsdMargin = data.hsd_margin !== undefined && data.hsd_margin !== null && data.hsd_margin !== '' ? N(data.hsd_margin) : 3.00;

  const totalSales = parseFloat((msAmt + hsdAmt).toFixed(2));

  // Dealer Commission / Gross Profit
  const msMarginAmt  = parseFloat((msSold * msMargin).toFixed(2));
  const hsdMarginAmt = parseFloat((hsdSold * hsdMargin).toFixed(2));
  const totalMargin  = parseFloat((msMarginAmt + hsdMarginAmt).toFixed(2));

  const cash   = N(data.cash_collected);
  const upi    = N(data.upi_collected);
  const card   = N(data.card_collected);
  const credit = N(data.credit_collected);
  const totalCollected = parseFloat((cash + upi + card + credit).toFixed(2));
  const shortExcess    = parseFloat((totalCollected - totalSales).toFixed(2));

  // Sanitize expenses list
  const expensesList = Array.isArray(data.expenses)
    ? data.expenses.filter(e => N(e.amt) > 0).map(e => ({
        id:          e.id || Date.now() + Math.random(),
        cat:         e.cat || 'Other',
        desc:        e.desc || '',
        to:          e.to || '',
        amt:         N(e.amt),
        vendor_id:   e.vendor_id || null,
        category_id: e.category_id || null,
      }))
    : [];

  const dayExpenses = parseFloat(expensesList.reduce((sum, e) => sum + e.amt, 0).toFixed(2));
  // Net cash in hand after shift expenses
  const netAmount   = parseFloat((totalCollected - dayExpenses).toFixed(2));
  // True net business profit (Gross Commission minus Station Expenses)
  const netProfit   = parseFloat((totalMargin - dayExpenses).toFixed(2));

  const payload = {
    entry_date: date,
    ms_price: msPrice,
    ms_open: msOpen,
    ms_close: msClose,
    ms_sold: msSold,
    ms_amount: msAmt,
    ms_dip_open: msDipO,
    ms_dip_close: msDipC,
    ms_dip_diff: msDipDiff,
    ms_margin: msMargin,

    hsd_price: hsdPrice,
    hsd_open: hsdOpen,
    hsd_close: hsdClose,
    hsd_sold: hsdSold,
    hsd_amount: hsdAmt,
    hsd_dip_open: hsdDipO,
    hsd_dip_close: hsdDipC,
    hsd_dip_diff: hsdDipDiff,
    hsd_margin: hsdMargin,

    total_sales: totalSales,
    cash_collected: cash,
    upi_collected: upi,
    card_collected: card,
    credit_collected: credit,
    total_collected: totalCollected,
    short_excess: shortExcess,
    total_margin: totalMargin,

    expenses: expensesList,
    day_expenses: dayExpenses,
    net_amount: netAmount,
    net_profit: netProfit,
    notes: data.notes || null,
    updated_by: userId || null,
  };

  const [record, created] = await DailyDaybook.findOrCreate({
    where: { entry_date: date },
    defaults: { ...payload, created_by: userId || null },
  });

  if (!created) {
    await record.update(payload);
  }

  // ── Auto-Sync Shift Petty Cash into Unified transactions (Day Book) ──
  // 1. Delete previously synced transactions for this shift to prevent duplicate entries
  await Transaction.destroy({
    where: {
      reference_type: 'SHIFT_EXPENSE',
      reference_id: record.id,
    },
  });

  // 2. Re-insert each shift expense as a verified Day Book cash expense voucher
  if (expensesList.length > 0) {
    const allCategories = await Category.findAll({ where: { type: 'EXPENSE' } });
    const allVendors = await Vendor.findAll();

    for (let i = 0; i < expensesList.length; i++) {
      const exp = expensesList[i];

      // Match or find category
      let matchedCat = allCategories.find(c => 
        (exp.category_id && c.id === exp.category_id) || 
        c.name.toLowerCase() === (exp.cat || '').toLowerCase()
      );

      if (!matchedCat) {
        matchedCat = await Category.create({
          name: exp.cat || 'Shift Expense',
          type: 'EXPENSE',
          is_active: true,
        });
      }

      // Match vendor/staff
      let matchedVendor = null;
      if (exp.vendor_id) {
        matchedVendor = allVendors.find(v => v.id === exp.vendor_id);
      } else if (exp.to && exp.to.trim()) {
        const toClean = exp.to.trim().toLowerCase();
        matchedVendor = allVendors.find(v => v.name.toLowerCase() === toClean);
      }

      const dateSlug = date.replace(/-/g, '');
      const voucherNo = `VCH-SE-${dateSlug}-${i + 1}-${Date.now().toString().slice(-4)}`;

      await Transaction.create({
        voucher_no: voucherNo,
        transaction_date: date,
        category_id: matchedCat.id,
        vendor_id: matchedVendor ? matchedVendor.id : null,
        amount: exp.amt,
        payment_mode: 'CASH', // Paid out of shift cash drawer
        reference_type: 'SHIFT_EXPENSE',
        reference_id: record.id,
        description: `[SHIFT EXPENSE] ${exp.desc || exp.cat}${exp.to ? ` (Paid to: ${exp.to})` : ''}`,
        created_by: userId || null,
      });
    }
  }

  return getByDate(date);
};

/**
 * Monthly or date-range history & aggregations
 */
const listHistory = async (query = {}) => {
  const where = {};
  if (query.month) {
    where.entry_date = {
      [Op.startsWith]: query.month, // 'YYYY-MM'
    };
  } else if (query.from_date || query.to_date) {
    where.entry_date = {};
    if (query.from_date) where.entry_date[Op.gte] = query.from_date;
    if (query.to_date)   where.entry_date[Op.lte] = query.to_date;
  }

  const rows = await DailyDaybook.findAll({
    where,
    order: [['entry_date', 'DESC']],
  });

  let totMS = 0, totHSD = 0, totSales = 0, totCash = 0, totUpi = 0, totCard = 0, totCredit = 0;
  let totColl = 0, totExp = 0, totNet = 0, totMargin = 0, totNetProfit = 0;
  let shortageCount = 0;

  rows.forEach(r => {
    const msSold = N(r.ms_sold);
    const hsdSold = N(r.hsd_sold);
    const msMgn = N(r.ms_margin) || 3.50;
    const hsdMgn = N(r.hsd_margin) || 3.00;
    const margin = N(r.total_margin) || parseFloat(((msSold * msMgn) + (hsdSold * hsdMgn)).toFixed(2));
    const dayExp = N(r.day_expenses);
    const profit = N(r.net_profit) || parseFloat((margin - dayExp).toFixed(2));

    totMS        += msSold;
    totHSD       += hsdSold;
    totSales     += N(r.total_sales);
    totCash      += N(r.cash_collected);
    totUpi       += N(r.upi_collected);
    totCard      += N(r.card_collected);
    totCredit    += N(r.credit_collected);
    totColl      += N(r.total_collected);
    totExp       += dayExp;
    totNet       += N(r.net_amount);
    totMargin    += margin;
    totNetProfit += profit;
    if (N(r.short_excess) < -1) shortageCount++;
  });

  const summary = {
    days_recorded: rows.length,
    shortage_days: shortageCount,
    total_ms_litres: parseFloat(totMS.toFixed(2)),
    total_hsd_litres: parseFloat(totHSD.toFixed(2)),
    total_sales: parseFloat(totSales.toFixed(2)),
    total_cash: parseFloat(totCash.toFixed(2)),
    total_upi: parseFloat(totUpi.toFixed(2)),
    total_card: parseFloat(totCard.toFixed(2)),
    total_credit: parseFloat(totCredit.toFixed(2)),
    total_collected: parseFloat(totColl.toFixed(2)),
    total_expenses: parseFloat(totExp.toFixed(2)),
    net_cash_flow: parseFloat(totNet.toFixed(2)),
    total_margin: parseFloat(totMargin.toFixed(2)),
    net_profit: parseFloat(totNetProfit.toFixed(2)),
    collection_percentage: totColl > 0 ? {
      cash: Math.round((totCash / totColl) * 100),
      upi: Math.round((totUpi / totColl) * 100),
      card: Math.round((totCard / totColl) * 100),
      credit: Math.round((totCredit / totColl) * 100),
    } : { cash: 0, upi: 0, card: 0, credit: 0 },
  };

  return { rows, summary };
};

const deleteDay = async (date) => {
  const row = await DailyDaybook.findOne({ where: { entry_date: date } });
  if (!row) throw new NotFoundError('Day Book entry not found');

  // Also clean up synced shift expense vouchers in transactions table
  await Transaction.destroy({
    where: {
      reference_type: 'SHIFT_EXPENSE',
      reference_id: row.id,
    },
  });

  await row.destroy();
  return { message: `Day Book for ${date} and synced shift vouchers deleted successfully` };
};

module.exports = {
  getByDate,
  saveDay,
  listHistory,
  deleteDay,
};
