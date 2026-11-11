const { User } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');
const { deleteOldProfileImage } = require('../middleware/uploadMiddleware');

const SAFE_ATTRS = { exclude: ['password'] };
const SORTABLE   = ['username', 'email', 'role', 'created_at', 'id'];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'created_at', 'id');

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
  if (existing) {
    if (data.profile_image) deleteOldProfileImage(data.profile_image);
    throw new ConflictError('A user with this email already exists');
  }

  try {
    const created = await User.create(data);
    return User.findByPk(created.id, { attributes: SAFE_ATTRS });
  } catch (err) {
    if (data.profile_image) deleteOldProfileImage(data.profile_image);
    throw err;
  }
};

const update = async (id, data, requesterId) => {
  const user = await getById(id);

  // Prevent self-deactivation or self-demotion
  if (requesterId && parseInt(id, 10) === parseInt(requesterId, 10)) {
    if (data.is_active === false || data.is_active === 0 || data.is_active === 'false') {
      if (data.profile_image) deleteOldProfileImage(data.profile_image);
      throw new ValidationError('You cannot deactivate your own account.');
    }
    if (user.role === 'ADMIN' && data.role && data.role !== 'ADMIN') {
      if (data.profile_image) deleteOldProfileImage(data.profile_image);
      throw new ValidationError('You cannot change your own role from Admin.');
    }
  }

  if (data.email && data.email !== user.email) {
    const existing = await User.findOne({ where: { email: data.email, id: { [Op.ne]: id } } });
    if (existing) {
      if (data.profile_image) deleteOldProfileImage(data.profile_image);
      throw new ConflictError('A user with this email already exists');
    }
  }

  // Handle image replacement or removal
  if (data.profile_image && data.profile_image !== user.profile_image) {
    deleteOldProfileImage(user.profile_image);
  } else if (data.remove_profile_image === 'true' || data.remove_profile_image === true) {
    deleteOldProfileImage(user.profile_image);
    data.profile_image = null;
  }

  await user.update(data);
  return user.reload({ attributes: SAFE_ATTRS });
};

const toggleStatus = async (id, requesterId) => {
  const user = await getById(id);

  if (requesterId && parseInt(id, 10) === parseInt(requesterId, 10) && user.is_active) {
    throw new ValidationError('You cannot deactivate your own account.');
  }

  await user.update({ is_active: !user.is_active });
  return getById(id);
};

const resetPassword = async (id, newPassword) => {
  const user = await getById(id);
  // Setting the 'password' field triggers the beforeUpdate hook in User.js, which hashes it
  await user.update({ password: newPassword });
};

module.exports = { list, getById, create, update, toggleStatus, resetPassword };
