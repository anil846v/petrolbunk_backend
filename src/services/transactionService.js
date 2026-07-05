const { Transaction, Category, Vendor, User } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');
const { generateVoucherNo } = require('../utils/voucher');
const sequelize = require('../config/database');

const SORTABLE = ['transaction_date', 'amount', 'created_at'];

const INCLUDE_REFS = [
  { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
  { model: Vendor,   as: 'vendor',   attributes: ['id', 'name', 'type'], required: false },
  { model: User,     as: 'creator',  attributes: ['id', 'username'],     required: false },
];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'transaction_date');

  const where = {};
  if (query.category_id)    where.category_id    = query.category_id;
  if (query.vendor_id)      where.vendor_id      = query.vendor_id;
  if (query.payment_mode)   where.payment_mode   = query.payment_mode;
  if (query.reference_type) where.reference_type = query.reference_type;

  if (query.from_date || query.to_date) {
    where.transaction_date = {};
    if (query.from_date) where.transaction_date[Op.gte] = query.from_date;
    if (query.to_date)   where.transaction_date[Op.lte] = query.to_date;
  }

  if (query.search) {
    where[Op.or] = [
      { voucher_no:  { [Op.like]: `%${query.search}%` } },
      { description: { [Op.like]: `%${query.search}%` } },
      { '$vendor.name$': { [Op.like]: `%${query.search}%` } },
    ];
  }

  const { rows, count } = await Transaction.findAndCountAll({
    where, limit, offset, order,
    include: INCLUDE_REFS,
    subQuery: false,
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

/**
 * Day Book summary — used for the reconciliation totals bar.
 *
 * Definitions:
 *   total_income     = manual INCOME entries (reference_type != FUEL), e.g. investments, other income
 *   invested_amount  = INCOME entries where category name is 'Investment'
 *   total_commission = INCOME entries where reference_type = 'FUEL' (fuel profit / commission)
 *   total_expense    = all EXPENSE entries
 *   net              = total_commission + total_income - total_expense
 */
const getSummary = async ({ from_date, to_date }) => {
  const dateWhere = {
    transaction_date: {
      [Op.gte]: from_date,
      [Op.lte]: to_date,
    },
  };

  const [byTypeAndRef, byMode, investRows] = await Promise.all([
    // Group by category type + reference_type to split fuel commission from other income
    Transaction.findAll({
      where:      dateWhere,
      include:    [{ model: Category, as: 'category', attributes: ['type'] }],
      attributes: [
        [fn('SUM', col('Transaction.amount')), 'total'],
        [col('category.type'), 'category_type'],
        'reference_type',
      ],
      group:    ['category.type', 'reference_type'],
      raw:      true,
      subQuery: false,
    }),

    // By payment mode
    Transaction.findAll({
      where:      dateWhere,
      attributes: [[fn('SUM', col('amount')), 'total'], 'payment_mode'],
      group:      ['payment_mode'],
      raw:        true,
    }),

    // Invested amount = INCOME entries under category named 'Investment'
    Transaction.findAll({
      where:   dateWhere,
      include: [{ model: Category, as: 'category', attributes: ['name', 'type'], where: { name: 'Investment', type: 'INCOME' } }],
      attributes: [[fn('SUM', col('Transaction.amount')), 'total']],
      raw:      true,
      subQuery: false,
    }),
  ]);

  let total_income = 0, total_commission = 0, total_expense = 0;
  byTypeAndRef.forEach((r) => {
    const amt = parseFloat(r.total || 0);
    if (r.category_type === 'EXPENSE') {
      total_expense += amt;
    } else if (r.category_type === 'INCOME') {
      if (r.reference_type === 'FUEL') {
        total_commission += amt;
      } else {
        total_income += amt;
      }
    }
  });

  const invested_amount = parseFloat(investRows[0]?.total || 0);

  return {
    total_income:     parseFloat(total_income.toFixed(2)),
    invested_amount:  parseFloat(invested_amount.toFixed(2)),
    total_commission: parseFloat(total_commission.toFixed(2)),
    total_expense:    parseFloat(total_expense.toFixed(2)),
    net:              parseFloat((total_commission + total_income - total_expense).toFixed(2)),
    by_payment_mode:  byMode.map((r) => ({
      payment_mode: r.payment_mode,
      total:        parseFloat(r.total),
    })),
  };
};

const getById = async (id, t = null) => {
  const opts = { include: INCLUDE_REFS };
  if (t) opts.transaction = t;
  const txn = await Transaction.findByPk(id, opts);
  if (!txn) throw new NotFoundError('Transaction not found');
  return txn;
};

/**
 * Creating a transaction is a two-step process:
 *   1. INSERT with a temp voucher_no placeholder (needed because the column is NOT NULL + UNIQUE)
 *   2. UPDATE voucher_no using the auto-incremented id that the DB assigned
 *
 * Accepts an optional external Sequelize `t` so callers like LoanTransactionService
 * can wrap this call inside their own DB transaction for atomicity.
 * When no `t` is provided, this function manages its own transaction.
 */
const create = async (data, createdBy, externalTransaction = null) => {
  const managed = !externalTransaction;
  const t = externalTransaction ?? (await sequelize.transaction());

  try {
    const temp = `TMP-${Date.now()}`;
    const txn  = await Transaction.create(
      { ...data, created_by: createdBy ?? null, updated_by: createdBy ?? null, voucher_no: temp },
      { transaction: t }
    );
    await txn.update({ voucher_no: generateVoucherNo(txn.id) }, { transaction: t });
    if (managed) await t.commit();
    // Pass `t` so the row is visible even before the external caller commits
    return getById(txn.id, managed ? null : t);
  } catch (err) {
    if (managed) await t.rollback();
    throw err;
  }
};

const update = async (id, data, updatedBy) => {
  const txn = await getById(id);
  if (txn.reference_type !== 'MANUAL') {
    throw new ValidationError(
      `Cannot edit a ${txn.reference_type} entry from Day Book. Use Today's Entry or Loan Payments instead.`
    );
  }
  await txn.update({ ...data, updated_by: updatedBy ?? null });
  return getById(id);
};

const remove = async (id) => {
  const txn = await getById(id);
  if (txn.reference_type !== 'MANUAL') {
    throw new ValidationError(
      `Cannot delete a ${txn.reference_type} entry from Day Book. Delete from the source page instead.`
    );
  }
  await txn.destroy();
};

module.exports = { list, getSummary, getById, create, update, remove };
