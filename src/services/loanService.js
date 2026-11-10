const { Loan, Transaction, Category, Vendor } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');

const SORTABLE = ['start_date', 'principal_amount', 'created_at', 'id'];

const INCLUDE_VENDOR = [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone', 'type'] }];

const isRepayment = (txn, loanType) => {
  if (txn.description && txn.description.includes('[REPAYMENT]')) return true;
  if (txn.description && txn.description.includes('[DISBURSEMENT]')) return false;
  if (loanType === 'GIVEN') return txn.category?.type === 'INCOME';
  return txn.category?.type === 'EXPENSE';
};

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'created_at', 'id');

  const where = {};
  if (query.loan_type) where.loan_type = query.loan_type;
  if (query.status)    where.status    = query.status;
  if (query.vendor_id) where.vendor_id = query.vendor_id;
  if (query.search) {
    where['$vendor.name$'] = { [Op.like]: `%${query.search}%` };
  }

  const { rows, count } = await Loan.findAndCountAll({
    where, limit, offset, order,
    include: INCLUDE_VENDOR,
    subQuery: false,
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

/**
 * Outstanding — all ACTIVE loans with their computed pending balance from unified transactions.
 */
const getOutstanding = async (query) => {
  const { page, limit, offset } = getPagination(query);

  const where = { status: 'ACTIVE' };
  if (query.loan_type) where.loan_type = query.loan_type;

  const { rows, count } = await Loan.findAndCountAll({
    where, limit, offset,
    include: [
      ...INCLUDE_VENDOR,
      { 
        model: Transaction, 
        as: 'transactions', 
        attributes: ['id', 'amount', 'description'],
        include: [{ model: Category, as: 'category', attributes: ['type'] }]
      },
    ],
    order: [['created_at', 'DESC']],
  });

  const enriched = rows.map((loan) => {
    const txns = loan.transactions || [];
    let disbursed = 0;
    let repaid = 0;

    txns.forEach((t) => {
      const amt = parseFloat(t.amount || 0);
      if (isRepayment(t, loan.loan_type)) {
        repaid += amt;
      } else {
        disbursed += amt;
      }
    });

    const principal = parseFloat(loan.principal_amount);
    const baseDebt = (loan.loan_type === 'TAKEN' && disbursed === 0) ? principal : (disbursed || principal);
    const balance = loan.loan_type === 'GIVEN'
      ? principal - repaid
      : baseDebt - repaid;

    return { ...loan.toJSON(), balance_pending: parseFloat(balance.toFixed(2)) };
  });

  return { rows: enriched, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const loan = await Loan.findByPk(id, { include: INCLUDE_VENDOR });
  if (!loan) throw new NotFoundError('Loan not found');
  return loan;
};

const create = async (data, createdBy) => {
  const vendor = await Vendor.findByPk(data.vendor_id);
  if (!vendor) throw new NotFoundError('Vendor not found');
  return Loan.create({
    vendor_id: data.vendor_id,
    loan_type: data.loan_type,
    principal_amount: data.principal_amount,
    interest_percent: data.interest_percent,
    start_date: data.start_date,
    end_date: data.end_date,
    notes: data.notes || data.remarks || null,
    created_by: createdBy ?? null,
  });
};

const update = async (id, data) => {
  const loan = await getById(id);
  if (loan.status === 'CLOSED') throw new ValidationError('Cannot update a closed loan');
  await loan.update(data);
  return loan.reload({ include: INCLUDE_VENDOR });
};

const close = async (id) => {
  const loan = await getById(id);
  if (loan.status === 'CLOSED') throw new ValidationError('Loan is already closed');
  await loan.update({ status: 'CLOSED' });
  return loan.reload({ include: INCLUDE_VENDOR });
};

/**
 * Full loan statement — loan details + every transaction with running balance.
 */
const getLedger = async (id) => {
  const loan = await Loan.findByPk(id, {
    include: [
      ...INCLUDE_VENDOR,
      {
        model: Transaction,
        as: 'transactions',
        include: [{ model: Category, as: 'category', attributes: ['type', 'name'] }],
      },
    ],
    order: [[{ model: Transaction, as: 'transactions' }, 'transaction_date', 'ASC']],
  });

  if (!loan) throw new NotFoundError('Loan not found');

  const hasDisbursements = (loan.transactions || []).some((t) => !isRepayment(t, loan.loan_type));
  let balance = loan.loan_type === 'GIVEN' || !hasDisbursements
    ? parseFloat(loan.principal_amount)
    : 0;

  const statement = (loan.transactions || []).map((t) => {
    const amt = parseFloat(t.amount);
    const repayment = isRepayment(t, loan.loan_type);
    const type = repayment ? 'REPAYMENT' : 'DISBURSEMENT';

    balance -= repayment ? amt : -amt;

    return {
      id: t.id,
      transaction_date: t.transaction_date,
      type,
      amount: amt,
      payment_mode: t.payment_mode,
      remarks: t.description,
      running_balance: parseFloat(balance.toFixed(2)),
    };
  });

  const totalDisbursed = statement
    .filter((s) => s.type === 'DISBURSEMENT')
    .reduce((a, s) => a + parseFloat(s.amount), 0);
  const totalRepaid = statement
    .filter((s) => s.type === 'REPAYMENT')
    .reduce((a, s) => a + parseFloat(s.amount), 0);

  return {
    loan:            loan.toJSON(),
    total_disbursed: parseFloat(totalDisbursed.toFixed(2)),
    total_repaid:    parseFloat(totalRepaid.toFixed(2)),
    balance_pending: parseFloat(balance.toFixed(2)),
    statement,
  };
};

module.exports = { list, getOutstanding, getById, create, update, close, getLedger };
