const { Vendor, Transaction, Loan, Category, LoanTransaction } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');

const SORTABLE = ['name', 'type', 'created_at', 'id'];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'created_at', 'id');

  const where = {};
  if (query.type)                    where.type      = query.type;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;
  if (query.search)                  where.name      = { [Op.like]: `%${query.search}%` };

  const { rows, count } = await Vendor.findAndCountAll({ where, limit, offset, order });
  return { rows, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const vendor = await Vendor.findByPk(id);
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
};

const create = async (data) => {
  if (data.phone) {
    const clash = await Vendor.findOne({ where: { name: data.name, phone: data.phone } });
    if (clash) throw new ConflictError('A vendor with this name and phone already exists');
  }
  return Vendor.create(data);
};

const update = async (id, data) => {
  const vendor = await getById(id);
  await vendor.update(data);
  return vendor.reload();
};

const toggleStatus = async (id) => {
  const vendor = await getById(id);
  await vendor.update({ is_active: !vendor.is_active });
  return vendor.reload();
};

/**
 * Vendor ledger — returns the vendor profile plus their full transaction and
 * loan history in separate paginated arrays.
 */
const getLedger = async (id, query) => {
  const vendor = await getById(id);

  const { page, limit, offset } = getPagination(query);
  const dateWhere = {};
  if (query.from_date) dateWhere[Op.gte] = query.from_date;
  if (query.to_date)   dateWhere[Op.lte] = query.to_date;

  const txnWhere = { vendor_id: id };
  if (Object.keys(dateWhere).length) txnWhere.transaction_date = dateWhere;

  const [transactions, loans] = await Promise.all([
    Transaction.findAndCountAll({
      where:   txnWhere,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'type'] }],
      order:   [['transaction_date', 'DESC']],
      limit,
      offset,
    }),
    Loan.findAndCountAll({
      where:   { vendor_id: id },
      include: [{ model: LoanTransaction, as: 'loanTransactions' }],
      order:   [['start_date', 'DESC']],
    }),
  ]);

  return {
    vendor,
    transactions: { rows: transactions.rows, meta: buildMeta(transactions.count, page, limit) },
    loans:        { rows: loans.rows, total: loans.count },
  };
};

module.exports = { list, getById, create, update, toggleStatus, getLedger };
