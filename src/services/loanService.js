const { Loan, LoanTransaction, Vendor } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const { NotFoundError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');

const SORTABLE = ['start_date', 'principal_amount', 'created_at'];

const INCLUDE_VENDOR = [{ model: Vendor, as: 'vendor', attributes: ['id', 'name', 'phone', 'type'] }];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'created_at');

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
 * Outstanding — all ACTIVE loans with their computed pending balance.
 * Balance = principal - SUM(repayments) for GIVEN loans.
 * Balance = SUM(disbursements) - SUM(repayments) for TAKEN loans.
 */
const getOutstanding = async (query) => {
  const { page, limit, offset } = getPagination(query);

  const where = { status: 'ACTIVE' };
  if (query.loan_type) where.loan_type = query.loan_type;

  const { rows, count } = await Loan.findAndCountAll({
    where, limit, offset,
    include: [
      ...INCLUDE_VENDOR,
      { model: LoanTransaction, as: 'loanTransactions', attributes: ['type', 'amount'] },
    ],
    order: [['created_at', 'DESC']],
  });

  const enriched = rows.map((loan) => {
    const txns       = loan.loanTransactions || [];
    const disbursed  = txns.filter((t) => t.type === 'DISBURSEMENT').reduce((s, t) => s + parseFloat(t.amount), 0);
    const repaid     = txns.filter((t) => t.type === 'REPAYMENT').reduce((s, t) => s + parseFloat(t.amount), 0);
    const principal  = parseFloat(loan.principal_amount);

    const balance = loan.loan_type === 'GIVEN'
      ? principal - repaid
      : disbursed - repaid;

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
  return Loan.create({ ...data, created_by: createdBy ?? null });
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
        model:   LoanTransaction,
        as:      'loanTransactions',
        order:   [['transaction_date', 'ASC']],
      },
    ],
    order: [[{ model: LoanTransaction, as: 'loanTransactions' }, 'transaction_date', 'ASC']],
  });

  if (!loan) throw new NotFoundError('Loan not found');

  let balance = loan.loan_type === 'GIVEN' ? parseFloat(loan.principal_amount) : 0;

  const statement = (loan.loanTransactions || []).map((lt) => {
    const amt = parseFloat(lt.amount);
    if (loan.loan_type === 'GIVEN') {
      balance -= lt.type === 'REPAYMENT' ? amt : -amt;
    } else {
      balance += lt.type === 'DISBURSEMENT' ? amt : -amt;
    }
    return { ...lt.toJSON(), running_balance: parseFloat(balance.toFixed(2)) };
  });

  const totalDisbursed = statement
    .filter((s) => s.type === 'DISBURSEMENT')
    .reduce((a, s) => a + parseFloat(s.amount), 0);
  const totalRepaid = statement
    .filter((s) => s.type === 'REPAYMENT')
    .reduce((a, s) => a + parseFloat(s.amount), 0);

  return {
    loan:           loan.toJSON(),
    total_disbursed: parseFloat(totalDisbursed.toFixed(2)),
    total_repaid:    parseFloat(totalRepaid.toFixed(2)),
    balance_pending: parseFloat(balance.toFixed(2)),
    statement,
  };
};

module.exports = { list, getOutstanding, getById, create, update, close, getLedger };
