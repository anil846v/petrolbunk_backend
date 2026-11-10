const { Transaction, Category, Loan, DailyDaybook } = require('../models');
const { Op, fn, col } = require('sequelize');

const isRepayment = (t, loanType) => {
  if (t.description && t.description.includes('[REPAYMENT]')) return true;
  if (t.description && t.description.includes('[DISBURSEMENT]')) return false;
  return loanType === 'GIVEN';
};

/**
 * All aggregations for the dashboard landing page.
 * Powered purely by the core streamlined tables: DailyDaybook, Transaction, Loan.
 */
const getSummary = async (params = {}) => {
  const { from_date, to_date } = params;
  const targetDate = from_date && to_date ? null : (from_date || to_date || new Date().toISOString().split('T')[0]);

  const dateFilter = {};
  const daybookDateFilter = {};

  if (from_date && to_date) {
    dateFilter.transaction_date = { [Op.gte]: from_date, [Op.lte]: to_date };
    daybookDateFilter.entry_date = { [Op.gte]: from_date, [Op.lte]: to_date };
  } else if (from_date) {
    dateFilter.transaction_date = { [Op.gte]: from_date };
    daybookDateFilter.entry_date = { [Op.gte]: from_date };
  } else if (to_date) {
    dateFilter.transaction_date = { [Op.lte]: to_date };
    daybookDateFilter.entry_date = { [Op.lte]: to_date };
  } else {
    dateFilter.transaction_date = targetDate;
    daybookDateFilter.entry_date = targetDate;
  }

  const [daybookRows, transactionRows, paymentModeRows, loanStats, loanPeriodTxns] = await Promise.all([
    // Daily Daybook shift sheets
    DailyDaybook.findAll({
      where: daybookDateFilter,
      raw:   true,
    }),

    // Transactions: income vs expense split
    Transaction.findAll({
      where:      dateFilter,
      attributes: [
        [fn('SUM', col('Transaction.amount')), 'total'],
        [col('category.type'), 'category_type'],
        'reference_type',
      ],
      include:    [{ model: Category, as: 'category', attributes: [] }],
      group:      ['category.type', 'reference_type'],
      raw:        true,
      subQuery:   false,
    }),

    // Transactions by payment mode
    Transaction.findAll({
      where:      dateFilter,
      attributes: [[fn('SUM', col('amount')), 'total'], 'payment_mode'],
      group:      ['payment_mode'],
      raw:        true,
    }),

    // Active loans + balance
    Loan.findAll({
      where:      { status: 'ACTIVE' },
      include:    [{ model: Transaction, as: 'transactions', attributes: ['amount', 'description'] }],
      attributes: ['id', 'loan_type', 'principal_amount'],
    }),

    // Loan transactions in date range
    Transaction.findAll({
      where:      { reference_type: 'LOAN', ...dateFilter },
      attributes: ['amount', 'description'],
      raw:        true,
    }),
  ]);

  // Aggregate fuel from DailyDaybook
  let msLitres = 0, msSales = 0, msCommission = 0;
  let hsdLitres = 0, hsdSales = 0, hsdCommission = 0;
  let dayExpenses = 0;
  let dbCash = 0, dbUpi = 0, dbCard = 0;

  daybookRows.forEach((d) => {
    const msL = parseFloat(d.ms_sold || 0);
    const msMgn = parseFloat(d.ms_margin || 3.50);
    const hsdL = parseFloat(d.hsd_sold || 0);
    const hsdMgn = parseFloat(d.hsd_margin || 3.00);

    msLitres     += msL;
    msSales      += parseFloat(d.ms_amount || 0);
    msCommission += parseFloat((msL * msMgn).toFixed(2));

    hsdLitres    += hsdL;
    hsdSales     += parseFloat(d.hsd_amount || 0);
    hsdCommission+= parseFloat((hsdL * hsdMgn).toFixed(2));

    dayExpenses  += parseFloat(d.day_expenses || 0);
    dbCash       += parseFloat(d.cash_collected || 0);
    dbUpi        += parseFloat(d.upi_collected || 0);
    dbCard       += parseFloat(d.card_collected || 0);
  });

  const fuelByType = [
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

  const fuelSummary = {
    total_litres: parseFloat((msLitres + hsdLitres).toFixed(2)),
    total_sales: parseFloat((msSales + hsdSales).toFixed(2)),
    total_commission: parseFloat((msCommission + hsdCommission).toFixed(2)),
  };

  // Aggregate transactions
  let total_income = 0, total_expense = 0;
  let hasSyncedShiftExpenses = false;
  transactionRows.forEach((r) => {
    const amt = parseFloat(r.total || 0);
    if (r.reference_type === 'SHIFT_EXPENSE') {
      hasSyncedShiftExpenses = true;
    }
    if (r.category_type === 'EXPENSE') {
      total_expense += amt;
    } else if (r.category_type === 'INCOME') {
      total_income += amt;
    }
  });

  // Only add dayExpenses if shift expenses were NOT synced into transactions table
  if (!hasSyncedShiftExpenses) {
    total_expense += dayExpenses;
  }

  const totalCommission = fuelSummary.total_commission;
  const net_profit = totalCommission + total_income - total_expense;

  const modeMap = { CASH: dbCash, UPI: dbUpi, CARD: dbCard, BANK: 0 };
  paymentModeRows.forEach((r) => {
    const m = (r.payment_mode || 'CASH').toUpperCase();
    modeMap[m] = (modeMap[m] || 0) + parseFloat(r.total || 0);
  });

  const byPaymentMode = Object.entries(modeMap)
    .filter(([_, val]) => val > 0)
    .map(([payment_mode, total]) => ({
      payment_mode,
      total: parseFloat(total.toFixed(2)),
    }));

  // Aggregate loans
  let totalOutstanding = 0;
  loanStats.forEach((loan) => {
    const txns = loan.transactions || [];
    let repaid = 0;
    let disbursed = 0;
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
    totalOutstanding += balance;
  });

  let disbursedPeriod = 0;
  let repaidPeriod = 0;
  loanPeriodTxns.forEach((t) => {
    const amt = parseFloat(t.amount || 0);
    if (t.description && t.description.includes('[REPAYMENT]')) {
      repaidPeriod += amt;
    } else {
      disbursedPeriod += amt;
    }
  });

  return {
    date: targetDate,
    fuel: {
      ...fuelSummary,
      by_type: fuelByType,
    },
    transactions: {
      total_income:    parseFloat(total_income.toFixed(2)),
      total_expense:   parseFloat(total_expense.toFixed(2)),
      by_payment_mode: byPaymentMode,
    },
    profit: {
      total_commission: parseFloat(totalCommission.toFixed(2)),
      total_expense:    parseFloat(total_expense.toFixed(2)),
      net_profit:       parseFloat(net_profit.toFixed(2)),
    },
    loans: {
      active_count:      loanStats.length,
      total_outstanding: parseFloat(totalOutstanding.toFixed(2)),
      today_disbursed:   parseFloat(disbursedPeriod.toFixed(2)),
      today_repaid:      parseFloat(repaidPeriod.toFixed(2)),
    },
  };
};

/**
 * Last N days fuel sales trend from DailyDaybook
 */
const getFuelTrend = async (days = 7) => {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().split('T')[0];

  const daybookRows = await DailyDaybook.findAll({
    where: { entry_date: { [Op.gte]: fromStr } },
    attributes: ['entry_date', 'ms_sold', 'hsd_sold', 'total_sales'],
    order: [['entry_date', 'ASC']],
    raw: true,
  });

  return daybookRows.map((d) => ({
    date: d.entry_date,
    total_litres: parseFloat(d.ms_sold || 0) + parseFloat(d.hsd_sold || 0),
    total_sales: parseFloat(d.total_sales || 0),
  }));
};

/**
 * Last N days income vs expense trend from Transaction & DailyDaybook
 */
const getIncomeExpenseTrend = async (days = 30) => {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().split('T')[0];

  const [rows, daybookRows] = await Promise.all([
    Transaction.findAll({
      where:      { transaction_date: { [Op.gte]: fromStr } },
      attributes: [
        'transaction_date',
        [fn('SUM', col('Transaction.amount')), 'total'],
        [col('category.type'), 'category_type'],
      ],
      include: [{ model: Category, as: 'category', attributes: [] }],
      group:   ['transaction_date', 'category.type'],
      order:   [['transaction_date', 'ASC']],
      raw:     true,
    }),
    DailyDaybook.findAll({
      where: { entry_date: { [Op.gte]: fromStr } },
      attributes: ['entry_date', 'day_expenses', 'total_collected'],
      raw: true,
    }),
  ]);

  const map = {};
  rows.forEach((r) => {
    const d = r.transaction_date;
    if (!map[d]) map[d] = { date: d, income: 0, expense: 0 };
    if (r.category_type === 'INCOME')  map[d].income  += parseFloat(r.total || 0);
    if (r.category_type === 'EXPENSE') map[d].expense += parseFloat(r.total || 0);
  });

  daybookRows.forEach((d) => {
    const date = d.entry_date;
    if (!map[date]) map[date] = { date, income: 0, expense: 0 };
    map[date].expense += parseFloat(d.day_expenses || 0);
  });

  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
};

module.exports = { getSummary, getFuelTrend, getIncomeExpenseTrend };
