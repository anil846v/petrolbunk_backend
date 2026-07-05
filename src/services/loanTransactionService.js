const { LoanTransaction, Loan, Vendor, Category, Transaction } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');
const transactionService = require('./transactionService');
const sequelize = require('../config/database');

const SORTABLE = ['transaction_date', 'amount', 'created_at'];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'transaction_date');

  const where = {};
  if (query.loan_id) where.loan_id = query.loan_id;
  if (query.type)    where.type    = query.type;
  if (query.from_date || query.to_date) {
    where.transaction_date = {};
    if (query.from_date) where.transaction_date[Op.gte] = query.from_date;
    if (query.to_date)   where.transaction_date[Op.lte] = query.to_date;
  }

  const { rows, count } = await LoanTransaction.findAndCountAll({
    where, limit, offset, order,
    include: [{
      model: Loan, as: 'loan', attributes: ['id', 'loan_type', 'vendor_id'],
      include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name'] }],
    }],
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const lt = await LoanTransaction.findByPk(id, {
    include: [{ model: Loan, as: 'loan' }],
  });
  if (!lt) throw new NotFoundError('Loan transaction not found');
  return lt;
};

/**
 * Records a loan transaction and automatically creates a mirrored entry
 * in the unified transactions (Day Book) table.
 *
 * Mapping — determines whether money flowed IN or OUT:
 *   GIVEN loan + REPAYMENT   → INCOME  (money came back to us)
 *   GIVEN loan + DISBURSEMENT → EXPENSE (we lent money out)
 *   TAKEN loan + REPAYMENT   → EXPENSE (we paid money back)
 *   TAKEN loan + DISBURSEMENT → INCOME  (we received money)
 *
 * Both inserts run inside a single DB transaction so a crash cannot
 * leave an orphaned loan_transaction without its Day Book counterpart.
 */
const create = async (data, createdBy) => {
  const loan = await Loan.findByPk(data.loan_id);
  if (!loan) throw new NotFoundError('Loan not found');
  if (loan.status === 'CLOSED') throw new ValidationError('Cannot add transactions to a closed loan');

  const isGiven = loan.loan_type === 'GIVEN';
  const categoryType =
    (isGiven && data.type === 'REPAYMENT') || (!isGiven && data.type === 'DISBURSEMENT')
      ? 'INCOME'
      : 'EXPENSE';

  // Find or create a default "Loan" category of the required type
  let categoryId = data.category_id;
  if (!categoryId) {
    const [cat] = await Category.findOrCreate({
      where:    { name: 'Loan', type: categoryType },
      defaults: { name: 'Loan', type: categoryType, is_active: true },
    });
    categoryId = cat.id;
  }

  const t = await sequelize.transaction();
  try {
    const loanTxn = await LoanTransaction.create(
      {
        loan_id:          data.loan_id,
        transaction_date: data.transaction_date,
        type:             data.type,
        amount:           data.amount,
        payment_mode:     data.payment_mode ?? 'CASH',
        remarks:          data.remarks ?? null,
      },
      { transaction: t }
    );

    // Mirror into Day Book
    await transactionService.create(
      {
        transaction_date: data.transaction_date,
        category_id:      categoryId,
        vendor_id:        loan.vendor_id,
        amount:           data.amount,
        payment_mode:     data.payment_mode,
        reference_type:   'LOAN',
        reference_id:     loanTxn.id,
        description:      data.remarks || `Loan ${data.type.toLowerCase()} — ${loan.loan_type.toLowerCase()}`,
      },
      createdBy,
      t   // pass the outer DB transaction so both inserts are atomic
    );

    await t.commit();
    return getById(loanTxn.id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

const remove = async (id) => {
  const lt = await getById(id);

  const t = await sequelize.transaction();
  try {
    // Remove the mirrored Day Book entry that was created when this loan transaction was recorded
    await Transaction.destroy({
      where:       { reference_type: 'LOAN', reference_id: lt.id },
      transaction: t,
    });
    await lt.destroy({ transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { list, getById, create, remove };
