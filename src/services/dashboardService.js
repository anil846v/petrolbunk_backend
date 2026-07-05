const { FuelSale, FuelType, Transaction, Category, Loan, LoanTransaction } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/database');

/**
 * All aggregations for the dashboard landing page.
 * No dedicated table — everything is computed at request time.
 * Supports date range filtering via from_date and to_date parameters.
 */
const getSummary = async (params = {}) => {
  const { from_date, to_date } = params;
  const targetDate = from_date && to_date ? null : (from_date || to_date || new Date().toISOString().split('T')[0]);

  // Build date filter
  const dateFilter = {};
  if (from_date && to_date) {
    dateFilter.transaction_date = { [Op.gte]: from_date, [Op.lte]: to_date };
  } else if (from_date) {
    dateFilter.transaction_date = { [Op.gte]: from_date };
  } else if (to_date) {
    dateFilter.transaction_date = { [Op.lte]: to_date };
  } else {
    dateFilter.transaction_date = targetDate;
  }

  const [fuelRows, transactionRows, paymentModeRows, loanStats, loanTodayRows] = await Promise.all([

    // ── Fuel: totals per fuel type for date range ──────────────────────
    FuelSale.findAll({
      where:      from_date && to_date ? { sale_date: { [Op.gte]: from_date, [Op.lte]: to_date } } : { sale_date: targetDate },
      attributes: [
        [fn('SUM', col('litres_sold')),       'total_litres'],
        [fn('SUM', col('sales_amount')),       'total_sales'],
        [fn('SUM', col('commission_amount')), 'total_commission'],
      ],
      include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
      group:   ['fuel_type_id', 'fuelType.id'],
      raw:     false,
    }),

    // ── Transactions: income vs expense split by reference_type ──────────
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

    // ── Transactions: by payment mode for date range ────────────────────
    Transaction.findAll({
      where:      dateFilter,
      attributes: [[fn('SUM', col('amount')), 'total'], 'payment_mode'],
      group:      ['payment_mode'],
      raw:        true,
    }),

    // ── Loans: active count + total outstanding ───────────────────────────
    Loan.findAll({
      where:      { status: 'ACTIVE' },
      include:    [{ model: LoanTransaction, as: 'loanTransactions', attributes: ['type', 'amount'] }],
      attributes: ['id', 'loan_type', 'principal_amount'],
    }),

    // ── Loans: movements for date range ─────────────────────────────────
    LoanTransaction.findAll({
      where:      dateFilter.transaction_date ? { transaction_date: dateFilter.transaction_date } : { transaction_date: targetDate },
      attributes: [[fn('SUM', col('amount')), 'total'], 'type'],
      group:      ['type'],
      raw:        true,
    }),
  ]);

  // ── Aggregate fuel ───────────────────────────────────────────────────
  const fuelByType = fuelRows.map((r) => ({
    fuel_type:        r.fuelType?.fuel_type,
    code:             r.fuelType?.code,
    total_litres:     parseFloat(r.get('total_litres') || 0),
    total_sales:      parseFloat(r.get('total_sales')  || 0),
    total_commission: parseFloat(r.get('total_commission') || 0),
  }));

  const fuelSummary = fuelByType.reduce(
    (acc, f) => ({
      total_litres:     acc.total_litres     + f.total_litres,
      total_sales:      acc.total_sales      + f.total_sales,
      total_commission: acc.total_commission + f.total_commission,
    }),
    { total_litres: 0, total_sales: 0, total_commission: 0 }
  );

  // ── Aggregate transactions ───────────────────────────────────────────
  // total_income  = manual INCOME entries in daybook (investments, other income)
  // total_expense = all EXPENSE entries in daybook
  // fuel commission is tracked separately via fuelSummary.total_commission
  let total_income = 0, total_expense = 0;
  transactionRows.forEach((r) => {
    const amt = parseFloat(r.total || 0);
    if (r.category_type === 'EXPENSE') {
      total_expense += amt;
    } else if (r.category_type === 'INCOME' && r.reference_type !== 'FUEL') {
      total_income += amt;
    }
  });

  // Profit = fuel commission only (as per business definition)
  const totalCommission = fuelSummary.total_commission;
  // Net = profit + other income - expenses
  const net_profit = totalCommission + total_income - total_expense;

  const byPaymentMode = paymentModeRows.map((r) => ({
    payment_mode: r.payment_mode,
    total:        parseFloat(r.total || 0),
  }));

  // ── Aggregate loans ──────────────────────────────────────────────────
  let totalOutstanding = 0;
  loanStats.forEach((loan) => {
    const txns     = loan.loanTransactions || [];
    const repaid   = txns.filter((t) => t.type === 'REPAYMENT').reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance  = loan.loan_type === 'GIVEN'
      ? parseFloat(loan.principal_amount) - repaid
      : txns.filter((t) => t.type === 'DISBURSEMENT').reduce((s, t) => s + parseFloat(t.amount), 0) - repaid;
    totalOutstanding += balance;
  });

  const disbursedToday = loanTodayRows.find((r) => r.type === 'DISBURSEMENT')?.total || 0;
  const repaidToday    = loanTodayRows.find((r) => r.type === 'REPAYMENT')?.total    || 0;

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
      today_disbursed:   parseFloat(disbursedToday),
      today_repaid:      parseFloat(repaidToday),
    },
  };
};

/**
 * Last N days fuel sales trend — for dashboard chart.
 */
const getFuelTrend = async (days = 7) => {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().split('T')[0];

  const rows = await FuelSale.findAll({
    where:      { sale_date: { [Op.gte]: fromStr } },
    attributes: [
      'sale_date',
      [fn('SUM', col('litres_sold')),  'total_litres'],
      [fn('SUM', col('sales_amount')), 'total_sales'],
    ],
    group: ['sale_date'],
    order: [['sale_date', 'ASC']],
    raw:   true,
  });

  return rows.map((r) => ({
    date:         r.sale_date,
    total_litres: parseFloat(r.total_litres || 0),
    total_sales:  parseFloat(r.total_sales  || 0),
  }));
};

/**
 * Last N days income vs expense trend — for dashboard chart.
 */
const getIncomeExpenseTrend = async (days = 30) => {
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromStr = from.toISOString().split('T')[0];

  const rows = await Transaction.findAll({
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
  });

  // Pivot into { date, income, expense } per day
  const map = {};
  rows.forEach((r) => {
    const d = r.transaction_date;
    if (!map[d]) map[d] = { date: d, income: 0, expense: 0 };
    if (r.category_type === 'INCOME')  map[d].income  = parseFloat(r.total || 0);
    if (r.category_type === 'EXPENSE') map[d].expense = parseFloat(r.total || 0);
  });

  return Object.values(map);
};

module.exports = { getSummary, getFuelTrend, getIncomeExpenseTrend };
