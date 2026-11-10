const { Transaction, Category, Vendor, Loan, DailyDaybook } = require('../models');
const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/database');

// ── Shared helpers ───────────────────────────────────────────────────────────

const dateRange = (from, to) => {
  const r = {};
  if (from) r[Op.gte] = from;
  if (to)   r[Op.lte] = to;
  return Object.keys(r).length > 0 ? r : { [Op.ne]: null };
};

const isRepayment = (t, loanType) => {
  if (t.description && t.description.includes('[REPAYMENT]')) return true;
  if (t.description && t.description.includes('[DISBURSEMENT]')) return false;
  return loanType === 'GIVEN';
};

// ── Fuel Reports (Driven purely by DailyDaybook) ──────────────────────────────

const getFuelDaily = async ({ from_date, to_date }) => {
  const rows = await DailyDaybook.findAll({
    where: { entry_date: dateRange(from_date, to_date) },
    order: [['entry_date', 'DESC']],
    raw: true,
  });

  return rows.map((r) => {
    const msLitres = parseFloat(r.ms_sold || 0);
    const hsdLitres = parseFloat(r.hsd_sold || 0);
    const msAmt = parseFloat(r.ms_amount || 0);
    const hsdAmt = parseFloat(r.hsd_amount || 0);
    const msMargin = parseFloat(r.ms_margin || 3.50);
    const hsdMargin = parseFloat(r.hsd_margin || 3.00);
    const comm = parseFloat(r.total_margin || 0) || parseFloat(((msLitres * msMargin) + (hsdLitres * hsdMargin)).toFixed(2));

    return {
      sale_date: r.entry_date,
      total_litres: msLitres + hsdLitres,
      total_sales: msAmt + hsdAmt,
      total_commission: comm,
      ms_litres: msLitres,
      ms_amount: msAmt,
      hsd_litres: hsdLitres,
      hsd_amount: hsdAmt,
    };
  });
};

const getFuelMonthly = async ({ from_date, to_date }) => {
  const rows = await DailyDaybook.findAll({
    where: { entry_date: dateRange(from_date, to_date) },
    order: [['entry_date', 'DESC']],
    raw: true,
  });

  const monthMap = {};
  rows.forEach((r) => {
    const month = String(r.entry_date).substring(0, 7);
    if (!monthMap[month]) {
      monthMap[month] = { month, total_litres: 0, total_sales: 0, total_commission: 0 };
    }
    const litres = parseFloat(r.ms_sold || 0) + parseFloat(r.hsd_sold || 0);
    const sales = parseFloat(r.total_sales || 0);
    const msMargin = parseFloat(r.ms_margin || 3.50);
    const hsdMargin = parseFloat(r.hsd_margin || 3.00);
    const comm = parseFloat(r.total_margin || 0) || ((parseFloat(r.ms_sold || 0) * msMargin) + (parseFloat(r.hsd_sold || 0) * hsdMargin));

    monthMap[month].total_litres += litres;
    monthMap[month].total_sales += sales;
    monthMap[month].total_commission += comm;
  });

  return Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
};

const getFuelByType = async ({ from_date, to_date }) => {
  const rows = await DailyDaybook.findAll({
    where: { entry_date: dateRange(from_date, to_date) },
    raw: true,
  });

  let msLitres = 0, msSales = 0;
  let hsdLitres = 0, hsdSales = 0;

  let msCommission = 0, hsdCommission = 0;

  rows.forEach((r) => {
    const msL = parseFloat(r.ms_sold || 0);
    const msMgn = parseFloat(r.ms_margin || 3.50);
    const hsdL = parseFloat(r.hsd_sold || 0);
    const hsdMgn = parseFloat(r.hsd_margin || 3.00);

    msLitres += msL;
    msSales += parseFloat(r.ms_amount || 0);
    msCommission += parseFloat((msL * msMgn).toFixed(2));

    hsdLitres += hsdL;
    hsdSales += parseFloat(r.hsd_amount || 0);
    hsdCommission += parseFloat((hsdL * hsdMgn).toFixed(2));
  });

  return [
    {
      fuel_type: 'Petrol',
      code: 'MS',
      total_litres: parseFloat(msLitres.toFixed(2)),
      total_sales: parseFloat(msSales.toFixed(2)),
      total_commission: parseFloat(msCommission.toFixed(2)),
    },
    {
      fuel_type: 'Diesel',
      code: 'HSD',
      total_litres: parseFloat(hsdLitres.toFixed(2)),
      total_sales: parseFloat(hsdSales.toFixed(2)),
      total_commission: parseFloat(hsdCommission.toFixed(2)),
    },
  ];
};

const getFuelCommission = async ({ from_date, to_date }) => {
  const rows = await getFuelDaily({ from_date, to_date });
  const grand_total = rows.reduce((s, r) => s + parseFloat(r.total_commission || 0), 0);
  return { rows, grand_total: parseFloat(grand_total.toFixed(2)) };
};

// ── Financial Reports ─────────────────────────────────────────────────────────

const getIncomeExpense = async ({ from_date, to_date, type }) => {
  const catWhere = {};
  if (type) catWhere.type = type;

  return Transaction.findAll({
    where:      { transaction_date: dateRange(from_date, to_date) },
    attributes: [[fn('SUM', col('Transaction.amount')), 'total'], [col('category.type'), 'category_type']],
    include:    [{
      model:      Category,
      as:         'category',
      where:      catWhere,
      attributes: ['id', 'name', 'type'],
    }],
    group:   ['category_id', 'category.id'],
    order:   [[fn('SUM', col('Transaction.amount')), 'DESC']],
    raw:     false,
  });
};

const getProfit = async ({ from_date, to_date }) => {
  const [daybookRows, txnSummary] = await Promise.all([
    DailyDaybook.findAll({
      where: { entry_date: dateRange(from_date, to_date) },
      attributes: ['ms_sold', 'hsd_sold', 'day_expenses', 'total_margin', 'ms_margin', 'hsd_margin'],
      raw: true,
    }),
    sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS total_expense
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.transaction_date BETWEEN :from_date AND :to_date`,
      { replacements: { from_date, to_date }, type: sequelize.QueryTypes.SELECT }
    ),
  ]);

  let fuel_commission = 0;
  daybookRows.forEach((r) => {
    fuel_commission += parseFloat(r.total_margin || 0) || 
      ((parseFloat(r.ms_sold || 0) * parseFloat(r.ms_margin || 3.50)) + 
       (parseFloat(r.hsd_sold || 0) * parseFloat(r.hsd_margin || 3.00)));
  });

  const total_income  = parseFloat(txnSummary[0]?.total_income || 0);
  const total_expense = parseFloat(txnSummary[0]?.total_expense || 0);
  const net_profit    = fuel_commission + total_income - total_expense;

  return {
    from_date,
    to_date,
    fuel_commission: parseFloat(fuel_commission.toFixed(2)),
    other_income:    parseFloat(total_income.toFixed(2)),
    expenses:        parseFloat(total_expense.toFixed(2)),
    net_profit:      parseFloat(net_profit.toFixed(2)),
  };
};

const getPaymentMode = async ({ from_date, to_date }) => {
  return Transaction.findAll({
    where:      { transaction_date: dateRange(from_date, to_date) },
    attributes: [[fn('SUM', col('amount')), 'total'], 'payment_mode'],
    group:      ['payment_mode'],
    order:      [[fn('SUM', col('amount')), 'DESC']],
    raw:        true,
  });
};

// ── Loan Reports ─────────────────────────────────────────────────────────────

const getLoansActive = async () => {
  const loans = await Loan.findAll({
    where:   { status: 'ACTIVE' },
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone'] },
      { model: Transaction, as: 'transactions', attributes: ['amount', 'description'] },
    ],
    order: [['start_date', 'ASC']],
  });

  return loans.map((loan) => {
    const txns = loan.transactions || [];
    let disbursed = 0;
    let repaid = 0;
    txns.forEach((t) => {
      const amt = parseFloat(t.amount || 0);
      if (isRepayment(t, loan.loan_type)) repaid += amt;
      else disbursed += amt;
    });

    const principal = parseFloat(loan.principal_amount || 0);
    const baseDebt = (loan.loan_type === 'TAKEN' && disbursed === 0) ? principal : (disbursed || principal);
    const balance = loan.loan_type === 'GIVEN'
      ? principal - repaid
      : baseDebt - repaid;

    return {
      ...loan.toJSON(),
      total_disbursed: parseFloat(disbursed.toFixed(2)),
      total_repaid:    parseFloat(repaid.toFixed(2)),
      balance_pending: parseFloat(balance.toFixed(2)),
    };
  });
};

const getLoansClosed = async ({ from_date, to_date }) => {
  const where = { status: 'CLOSED' };
  if (from_date || to_date) {
    where.updated_at = {};
    if (from_date) where.updated_at[Op.gte] = from_date;
    if (to_date)   where.updated_at[Op.lte] = to_date;
  }

  return Loan.findAll({
    where,
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone'] }],
    order:   [['updated_at', 'DESC']],
  });
};

const getLoansInterest = async () => {
  const loans = await Loan.findAll({
    where:   { status: 'ACTIVE' },
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
      { model: Transaction, as: 'transactions', attributes: ['amount', 'description'] },
    ],
  });

  return loans.map((loan) => {
    const principal   = parseFloat(loan.principal_amount);
    const rate        = parseFloat(loan.interest_percent) / 100;
    const start       = new Date(loan.start_date);
    const today       = new Date();
    const daysElapsed = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));

    let repaid = 0;
    (loan.transactions || []).forEach((t) => {
      if (isRepayment(t, loan.loan_type)) repaid += parseFloat(t.amount || 0);
    });

    const outstanding      = Math.max(0, principal - repaid);
    const interestAccrued  = parseFloat((outstanding * rate * (daysElapsed / 365)).toFixed(2));

    return {
      loan:             loan.toJSON(),
      outstanding,
      days_elapsed:     daysElapsed,
      interest_accrued: interestAccrued,
    };
  });
};

// ── Vendor Ledger ─────────────────────────────────────────────────────────────

const getVendorLedger = async (vendorId, { from_date, to_date }) => {
  const vendor = await Vendor.findByPk(vendorId);
  if (!vendor) return null;

  const txnWhere = { vendor_id: vendorId };
  if (from_date || to_date) {
    txnWhere.transaction_date = {};
    if (from_date) txnWhere.transaction_date[Op.gte] = from_date;
    if (to_date)   txnWhere.transaction_date[Op.lte] = to_date;
  }

  const [transactions, loans] = await Promise.all([
    Transaction.findAll({
      where:   txnWhere,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'type'] }],
      order:   [['transaction_date', 'DESC']],
    }),
    Loan.findAll({
      where:   { vendor_id: vendorId },
      include: [{ model: Transaction, as: 'transactions' }],
      order:   [['start_date', 'DESC']],
    }),
  ]);

  return { vendor, transactions, loans };
};

const getCategoryWise = async ({ from_date, to_date, type }) => {
  const catWhere = {};
  if (type) catWhere.type = type;

  return Transaction.findAll({
    where:      { transaction_date: dateRange(from_date, to_date) },
    attributes: [[fn('SUM', col('Transaction.amount')), 'total']],
    include:    [{
      model:      Category,
      as:         'category',
      where:      catWhere,
      attributes: ['id', 'name', 'type'],
    }],
    group: ['category_id', 'category.id'],
    order: [[fn('SUM', col('Transaction.amount')), 'DESC']],
  });
};

const getMonthlyReport = async ({ from_date, to_date, month }) => {
  let start = from_date;
  let end = to_date;
  if (!start && month) {
    start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    end = `${month}-${String(lastDay).padStart(2, '0')}`;
  }
  if (!start) start = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  if (!end) end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  const [daybookSummary, txnSummary, categoryBreakdown] = await Promise.all([
    DailyDaybook.findAll({
      where: { entry_date: dateRange(start, end) },
      order: [['entry_date', 'DESC']],
      raw: true,
    }),
    sequelize.query(
      `SELECT
         COALESCE(SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END), 0) AS total_income,
         COALESCE(SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS total_expense
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.transaction_date BETWEEN :start AND :end`,
      { replacements: { start, end }, type: sequelize.QueryTypes.SELECT }
    ),
    sequelize.query(
      `SELECT
         c.name AS category_name,
         c.type AS category_type,
         COALESCE(SUM(t.amount), 0) AS total_amount
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.transaction_date BETWEEN :start AND :end
       GROUP BY c.id, c.name, c.type
       ORDER BY total_amount DESC`,
      { replacements: { start, end }, type: sequelize.QueryTypes.SELECT }
    ),
  ]);

  let total_litres = 0;
  let total_amount = 0;
  let total_commission = 0;

  let ms_litres = 0, ms_amount = 0, ms_commission = 0;
  let hsd_litres = 0, hsd_amount = 0, hsd_commission = 0;

  let cash_collected = 0;
  let upi_collected = 0;
  let card_collected = 0;
  let credit_collected = 0;
  let total_collected = 0;
  let short_excess = 0;

  const breakdownMap = {};

  daybookSummary.forEach((d) => {
    const msL = parseFloat(d.ms_sold || 0);
    const hsdL = parseFloat(d.hsd_sold || 0);
    const msAmt = parseFloat(d.ms_amount || 0);
    const hsdAmt = parseFloat(d.hsd_amount || 0);
    const msMgn = parseFloat(d.ms_margin || 3.50);
    const hsdMgn = parseFloat(d.hsd_margin || 3.00);
    const msComm = parseFloat((msL * msMgn).toFixed(2));
    const hsdComm = parseFloat((hsdL * hsdMgn).toFixed(2));
    const dayComm = parseFloat(d.total_margin || 0) || (msComm + hsdComm);

    const dayLitres = msL + hsdL;
    const dayAmount = parseFloat(d.total_sales || 0);

    const cCash = parseFloat(d.cash_collected || 0);
    const cUpi = parseFloat(d.upi_collected || 0);
    const cCard = parseFloat(d.card_collected || 0);
    const cCredit = parseFloat(d.credit_collected || 0);
    const cTotal = parseFloat(d.total_collected || 0) || (cCash + cUpi + cCard + cCredit);
    const cShort = parseFloat(d.short_excess || 0);

    total_litres += dayLitres;
    total_amount += dayAmount;
    total_commission += dayComm;

    ms_litres += msL;
    ms_amount += msAmt;
    ms_commission += msComm;

    hsd_litres += hsdL;
    hsd_amount += hsdAmt;
    hsd_commission += hsdComm;

    cash_collected += cCash;
    upi_collected += cUpi;
    card_collected += cCard;
    credit_collected += cCredit;
    total_collected += cTotal;
    short_excess += cShort;

    const dateStr = d.entry_date;
    breakdownMap[dateStr] = {
      date: dateStr,
      litres: dayLitres,
      ms_litres: msL,
      ms_amount: msAmt,
      hsd_litres: hsdL,
      hsd_amount: hsdAmt,
      fuel_amount: dayAmount,
      commission: dayComm,
      cash_collected: cCash,
      upi_collected: cUpi,
      card_collected: cCard,
      credit_collected: cCredit,
      total_collected: cTotal,
      short_excess: cShort,
      income: 0,
      expense: 0,
      net: 0,
      net_profit: dayComm,
    };
  });

  const txnDays = await sequelize.query(
    `SELECT
       t.transaction_date AS sale_date,
       SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END) AS income,
       SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END) AS expense
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.transaction_date BETWEEN :start AND :end
     GROUP BY t.transaction_date`,
    { replacements: { start, end }, type: sequelize.QueryTypes.SELECT }
  );

  txnDays.forEach((t) => {
    const dateStr = t.sale_date;
    if (!breakdownMap[dateStr]) {
      breakdownMap[dateStr] = {
        date: dateStr,
        litres: 0,
        ms_litres: 0,
        ms_amount: 0,
        hsd_litres: 0,
        hsd_amount: 0,
        fuel_amount: 0,
        commission: 0,
        cash_collected: 0,
        upi_collected: 0,
        card_collected: 0,
        credit_collected: 0,
        total_collected: 0,
        short_excess: 0,
        income: 0,
        expense: 0,
        net: 0,
        net_profit: 0,
      };
    }
    const dayInc = parseFloat(t.income || 0);
    const dayExp = parseFloat(t.expense || 0);
    breakdownMap[dateStr].income += dayInc;
    breakdownMap[dateStr].expense += dayExp;
  });

  const dailyBreakdown = Object.values(breakdownMap).map((day) => {
    day.net = day.income - day.expense;
    day.net_profit = parseFloat((day.commission + day.income - day.expense).toFixed(2));
    return day;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const total_income = parseFloat(txnSummary[0]?.total_income || 0);
  const total_expense = parseFloat(txnSummary[0]?.total_expense || 0);
  const net_profit = parseFloat((total_commission + total_income - total_expense).toFixed(2));

  // Category breakdowns with percentages
  const expenses_by_category = [];
  const incomes_by_category = [];

  categoryBreakdown.forEach((c) => {
    const amt = parseFloat(c.total_amount || 0);
    if (c.category_type === 'EXPENSE') {
      const pct = total_expense > 0 ? parseFloat(((amt / total_expense) * 100).toFixed(1)) : 0;
      expenses_by_category.push({ name: c.category_name, amount: amt, percent: pct });
    } else if (c.category_type === 'INCOME') {
      const pct = total_income > 0 ? parseFloat(((amt / total_income) * 100).toFixed(1)) : 0;
      incomes_by_category.push({ name: c.category_name, amount: amt, percent: pct });
    }
  });

  const totalCollClean = total_collected || total_amount;
  const collections_breakdown = [
    {
      mode: 'CASH',
      label: 'Cash in Hand',
      amount: parseFloat(cash_collected.toFixed(2)),
      percent: totalCollClean > 0 ? parseFloat(((cash_collected / totalCollClean) * 100).toFixed(1)) : 0,
      icon: 'Cash',
      color: 'emerald',
    },
    {
      mode: 'UPI',
      label: 'PhonePe / GPay / UPI',
      amount: parseFloat(upi_collected.toFixed(2)),
      percent: totalCollClean > 0 ? parseFloat(((upi_collected / totalCollClean) * 100).toFixed(1)) : 0,
      icon: 'Smartphone',
      color: 'blue',
    },
    {
      mode: 'CARD',
      label: 'Card / POS Swipes',
      amount: parseFloat(card_collected.toFixed(2)),
      percent: totalCollClean > 0 ? parseFloat(((card_collected / totalCollClean) * 100).toFixed(1)) : 0,
      icon: 'CreditCard',
      color: 'violet',
    },
    {
      mode: 'CREDIT',
      label: 'Company / Fleet Credit',
      amount: parseFloat(credit_collected.toFixed(2)),
      percent: totalCollClean > 0 ? parseFloat(((credit_collected / totalCollClean) * 100).toFixed(1)) : 0,
      icon: 'Building2',
      color: 'amber',
    },
  ];

  return {
    fuel: {
      total_litres: parseFloat(total_litres.toFixed(2)),
      total_amount: parseFloat(total_amount.toFixed(2)),
      total_commission: parseFloat(total_commission.toFixed(2)),
      ms: {
        litres: parseFloat(ms_litres.toFixed(2)),
        amount: parseFloat(ms_amount.toFixed(2)),
        commission: parseFloat(ms_commission.toFixed(2)),
      },
      hsd: {
        litres: parseFloat(hsd_litres.toFixed(2)),
        amount: parseFloat(hsd_amount.toFixed(2)),
        commission: parseFloat(hsd_commission.toFixed(2)),
      },
    },
    collections: {
      total_sales: parseFloat(total_amount.toFixed(2)),
      total_collected: parseFloat(total_collected.toFixed(2)),
      cash_collected: parseFloat(cash_collected.toFixed(2)),
      upi_collected: parseFloat(upi_collected.toFixed(2)),
      card_collected: parseFloat(card_collected.toFixed(2)),
      credit_collected: parseFloat(credit_collected.toFixed(2)),
      short_excess: parseFloat(short_excess.toFixed(2)),
      breakdown: collections_breakdown,
    },
    financials: {
      fuel_commission: parseFloat(total_commission.toFixed(2)),
      total_income,
      total_expense,
      net_balance: total_income - total_expense,
      net_profit,
      expenses_by_category,
      incomes_by_category,
    },
    transactions: {
      total_income,
      total_expense,
      net: total_income - total_expense,
    },
    daily_breakdown: dailyBreakdown,
  };
};

module.exports = {
  getFuelDaily,
  getFuelMonthly,
  getFuelByType,
  getFuelCommission,
  getIncomeExpense,
  getProfit,
  getPaymentMode,
  getLoansActive,
  getLoansClosed,
  getLoansInterest,
  getVendorLedger,
  getCategoryWise,
  getMonthlyReport,
};
