const { Loan, Vendor, Category, Transaction } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');
const transactionService = require('./transactionService');

const SORTABLE = ['transaction_date', 'amount', 'created_at', 'id'];

const getTypeFromTxn = (txn, loanType) => {
  if (txn.description && txn.description.includes('[REPAYMENT]')) return 'REPAYMENT';
  if (txn.description && txn.description.includes('[DISBURSEMENT]')) return 'DISBURSEMENT';
  if (loanType === 'GIVEN') {
    return txn.category?.type === 'INCOME' ? 'REPAYMENT' : 'DISBURSEMENT';
  }
  return txn.category?.type === 'EXPENSE' ? 'REPAYMENT' : 'DISBURSEMENT';
};

const cleanRemarks = (desc) => {
  if (!desc) return '';
  return desc.replace(/^\[(DISBURSEMENT|REPAYMENT)\]\s*/i, '');
};

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'transaction_date', 'id');

  const where = { reference_type: 'LOAN' };
  if (query.loan_id) where.reference_id = query.loan_id;
  if (query.from_date || query.to_date) {
    where.transaction_date = {};
    if (query.from_date) where.transaction_date[Op.gte] = query.from_date;
    if (query.to_date)   where.transaction_date[Op.lte] = query.to_date;
  }

  const { rows, count } = await Transaction.findAndCountAll({
    where, limit, offset, order,
    include: [
      {
        model: Loan,
        as: 'loan',
        attributes: ['id', 'loan_type', 'vendor_id'],
        include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name'] }],
      },
      { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
    ],
  });

  const formattedRows = rows.map((t) => {
    const loan = t.loan || {};
    const type = getTypeFromTxn(t, loan.loan_type);
    return {
      id: t.id,
      loan_id: t.reference_id,
      transaction_date: t.transaction_date,
      type,
      amount: t.amount,
      payment_mode: t.payment_mode,
      remarks: cleanRemarks(t.description),
      loan: {
        id: loan.id,
        loan_type: loan.loan_type,
        vendor: loan.vendor,
      },
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  });

  // Filter by type in-memory if specified
  const filtered = query.type
    ? formattedRows.filter((r) => r.type === query.type)
    : formattedRows;

  return { rows: filtered, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const t = await Transaction.findOne({
    where: { id, reference_type: 'LOAN' },
    include: [
      {
        model: Loan,
        as: 'loan',
        attributes: ['id', 'loan_type', 'vendor_id'],
        include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'name'] }],
      },
      { model: Category, as: 'category', attributes: ['id', 'name', 'type'] },
    ],
  });

  if (!t) throw new NotFoundError('Loan transaction not found');

  const loan = t.loan || {};
  return {
    id: t.id,
    loan_id: t.reference_id,
    transaction_date: t.transaction_date,
    type: getTypeFromTxn(t, loan.loan_type),
    amount: t.amount,
    payment_mode: t.payment_mode,
    remarks: cleanRemarks(t.description),
    loan: {
      id: loan.id,
      loan_type: loan.loan_type,
      vendor: loan.vendor,
    },
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
};

/**
 * Records a loan transaction directly into the unified transactions (Day Book) table.
 * Zero duplicate tables needed.
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

  let categoryId = data.category_id;
  if (!categoryId) {
    const [cat] = await Category.findOrCreate({
      where:    { name: 'Loan', type: categoryType },
      defaults: { name: 'Loan', type: categoryType, is_active: true },
    });
    categoryId = cat.id;
  }

  const prefix = `[${data.type}]`;
  const desc = data.remarks ? `${prefix} ${data.remarks}` : `${prefix} Loan ${data.type.toLowerCase()}`;

  const txn = await transactionService.create(
    {
      transaction_date: data.transaction_date,
      category_id:      categoryId,
      vendor_id:        loan.vendor_id,
      amount:           data.amount,
      payment_mode:     data.payment_mode ?? 'CASH',
      reference_type:   'LOAN',
      reference_id:     loan.id,
      description:      desc,
    },
    createdBy
  );

  return getById(txn.id);
};

const remove = async (id) => {
  const txn = await Transaction.findOne({ where: { id, reference_type: 'LOAN' } });
  if (!txn) throw new NotFoundError('Loan transaction not found');
  await txn.destroy();
};

module.exports = { list, getById, create, remove };
