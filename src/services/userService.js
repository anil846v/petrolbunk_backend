const { User } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');

const SAFE_ATTRS = { exclude: ['password'] };
const SORTABLE   = ['username', 'email', 'role', 'created_at'];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'created_at');

  const where = {};
  if (query.role)      where.role      = query.role;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;
  if (query.search)    where[Op.or] = [
    { username: { [Op.like]: `%${query.search}%` } },
    { email:    { [Op.like]: `%${query.search}%` } },
  ];

  const { rows, count } = await User.findAndCountAll({
    where, limit, offset, order,
    attributes: SAFE_ATTRS,
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const user = await User.findByPk(id, { attributes: SAFE_ATTRS });
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const create = async (data) => {
  const existing = await User.findOne({ where: { email: data.email } });
  if (existing) throw new ConflictError('A user with this email already exists');

  return User.create(data);
};

const update = async (id, data) => {
  const user = await getById(id);
  await user.update(data);
  return user.reload({ attributes: SAFE_ATTRS });
};

const toggleStatus = async (id) => {
  const user = await getById(id);
  await user.update({ is_active: !user.is_active });
  return getById(id);
};

const resetPassword = async (id, newPassword) => {
  const user = await getById(id);
  // Setting the 'password' field triggers the beforeUpdate hook in User.js, which hashes it
  await user.update({ password: newPassword });
};

module.exports = { list, getById, create, update, toggleStatus, resetPassword };
