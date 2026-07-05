const { FuelSale, FuelType, Transaction, Category, Vendor, Loan, LoanTransaction } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/database');

// ── Shared helpers ───────────────────────────────────────────────────────────

const dateRange = (from, to) => ({
  [Op.gte]: from,
  [Op.lte]: to,
});

// ── Fuel Reports ─────────────────────────────────────────────────────────────

const getFuelDaily = async ({ from_date, to_date, fuel_type_id }) => {
  const where = { sale_date: dateRange(from_date, to_date) };
  if (fuel_type_id) where.fuel_type_id = fuel_type_id;

  return FuelSale.findAll({
    where,
    attributes: [
      'sale_date',
      [fn('SUM', col('litres_sold')),       'total_litres'],
      [fn('SUM', col('sales_amount')),       'total_sales'],
      [fn('SUM', col('commission_amount')), 'total_commission'],
    ],
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
    group:   ['sale_date', 'fuelType.id'],
    order:   [['sale_date', 'DESC']],
    raw:     false,
  });
};

const getFuelMonthly = async ({ from_date, to_date }) => {
  const rows = await sequelize.query(
    `SELECT
       DATE_FORMAT(sale_date, '%Y-%m') AS month,
       SUM(litres_sold)       AS total_litres,
       SUM(sales_amount)      AS total_sales,
       SUM(commission_amount) AS total_commission
     FROM fuel_sales
     WHERE sale_date BETWEEN :from_date AND :to_date
     GROUP BY month
     ORDER BY month DESC`,
    { replacements: { from_date, to_date }, type: sequelize.QueryTypes.SELECT }
  );
  return rows;
};

const getFuelByType = async ({ from_date, to_date }) => {
  return FuelSale.findAll({
    where:      { sale_date: dateRange(from_date, to_date) },
    attributes: [
      [fn('SUM', col('litres_sold')),       'total_litres'],
      [fn('SUM', col('sales_amount')),       'total_sales'],
      [fn('SUM', col('commission_amount')), 'total_commission'],
    ],
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
    group:   ['fuel_type_id', 'fuelType.id'],
    order:   [[fn('SUM', col('sales_amount')), 'DESC']],
  });
};

const getFuelCommission = async ({ from_date, to_date, fuel_type_id }) => {
  const where = { sale_date: dateRange(from_date, to_date) };
  if (fuel_type_id) where.fuel_type_id = fuel_type_id;

  const rows = await FuelSale.findAll({
    where,
    attributes: [
      'sale_date',
      [fn('SUM', col('litres_sold')),       'total_litres'],
      [fn('SUM', col('commission_amount')), 'total_commission'],
    ],
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
    group:   ['sale_date', 'fuelType.id'],
    order:   [['sale_date', 'DESC']],
  });

  const grand_total = rows.reduce((s, r) => s + parseFloat(r.get('total_commission') || 0), 0);
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
  const rows = await sequelize.query(
    `SELECT
       COALESCE(SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS total_expense
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.transaction_date BETWEEN :from_date AND :to_date`,
    { replacements: { from_date, to_date }, type: sequelize.QueryTypes.SELECT }
  );

  const { total_income, total_expense } = rows[0];
  return {
    total_income:  parseFloat(total_income),
    total_expense: parseFloat(total_expense),
    net_profit:    parseFloat(total_income) - parseFloat(total_expense),
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

// ── Loan Reports ──────────────────────────────────────────────────────────────

const getLoansActive = async ({ loan_type } = {}) => {
  const where = { status: 'ACTIVE' };
  if (loan_type) where.loan_type = loan_type;

  return Loan.findAll({
    where,
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone'] },
      { model: LoanTransaction, as: 'loanTransactions', attributes: ['type', 'amount'] },
    ],
    order: [['created_at', 'DESC']],
  });
};

const getLoansClosed = async ({ loan_type } = {}) => {
  const where = { status: 'CLOSED' };
  if (loan_type) where.loan_type = loan_type;

  return Loan.findAll({
    where,
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone'] }],
    order:   [['created_at', 'DESC']],
  });
};

const getLoansInterest = async () => {
  const loans = await Loan.findAll({
    where:   { status: 'ACTIVE', interest_percent: { [Op.gt]: 0 } },
    include: [
      { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
      { model: LoanTransaction, as: 'loanTransactions', attributes: ['type', 'amount', 'transaction_date'] },
    ],
  });

  return loans.map((loan) => {
    const principal   = parseFloat(loan.principal_amount);
    const rate        = parseFloat(loan.interest_percent) / 100;
    const start       = new Date(loan.start_date);
    const today       = new Date();
    const daysElapsed = Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));

    const repaid       = (loan.loanTransactions || [])
      .filter((t) => t.type === 'REPAYMENT')
      .reduce((s, t) => s + parseFloat(t.amount), 0);

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
      include: [{ model: LoanTransaction, as: 'loanTransactions' }],
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

const getMonthlyReport = async ({ from_date, to_date }) => {
  // 1. Get Fuel Summary
  const fuelSummary = await FuelSale.findOne({
    where: { sale_date: dateRange(from_date, to_date) },
    attributes: [
      [fn('COALESCE', fn('SUM', col('litres_sold')), 0), 'total_litres'],
      [fn('COALESCE', fn('SUM', col('sales_amount')), 0), 'total_amount'],
      [fn('COALESCE', fn('SUM', col('commission_amount')), 0), 'total_commission'],
    ],
    raw: true,
  });

  // 2. Get Transaction Summary
  const txnSummary = await sequelize.query(
    `SELECT
       COALESCE(SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS total_expense
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.transaction_date BETWEEN :from_date AND :to_date`,
    { replacements: { from_date, to_date }, type: sequelize.QueryTypes.SELECT }
  );

  const total_income = parseFloat(txnSummary[0]?.total_income || 0);
  const total_expense = parseFloat(txnSummary[0]?.total_expense || 0);

  // 3. Get Daily Breakdown
  const fuelDays = await FuelSale.findAll({
    where: { sale_date: dateRange(from_date, to_date) },
    attributes: [
      'sale_date',
      [fn('SUM', col('litres_sold')), 'litres'],
      [fn('SUM', col('sales_amount')), 'fuel_amount'],
    ],
    group: ['sale_date'],
    raw: true,
  });

  const txnDays = await sequelize.query(
    `SELECT
       t.transaction_date AS sale_date,
       SUM(CASE WHEN c.type = 'INCOME'  THEN t.amount ELSE 0 END) AS income,
       SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END) AS expense
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.transaction_date BETWEEN :from_date AND :to_date
     GROUP BY t.transaction_date`,
    { replacements: { from_date, to_date }, type: sequelize.QueryTypes.SELECT }
  );

  const breakdownMap = {};

  fuelDays.forEach((f) => {
    breakdownMap[f.sale_date] = {
      date: f.sale_date,
      litres: parseFloat(f.litres || 0),
      fuel_amount: parseFloat(f.fuel_amount || 0),
      income: 0,
      expense: 0,
      net: 0,
    };
  });

  txnDays.forEach((t) => {
    const dateStr = t.sale_date;
    if (!breakdownMap[dateStr]) {
      breakdownMap[dateStr] = {
        date: dateStr,
        litres: 0,
        fuel_amount: 0,
        income: 0,
        expense: 0,
        net: 0,
      };
    }
    breakdownMap[dateStr].income = parseFloat(t.income || 0);
    breakdownMap[dateStr].expense = parseFloat(t.expense || 0);
  });

  const dailyBreakdown = Object.values(breakdownMap).map((day) => {
    day.net = day.income - day.expense;
    return day;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return {
    fuel: {
      total_litres: parseFloat(fuelSummary?.total_litres || 0),
      total_amount: parseFloat(fuelSummary?.total_amount || 0),
      total_commission: parseFloat(fuelSummary?.total_commission || 0),
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
