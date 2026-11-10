const { Category } = require('../models');
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

  const { rows, count } = await Category.findAndCountAll({ where, limit, offset, order });
  return { rows, meta: buildMeta(count, page, limit) };
};

const getById = async (id) => {
  const cat = await Category.findByPk(id);
  if (!cat) throw new NotFoundError('Category not found');
  return cat;
};

const create = async (data) => {
  const existing = await Category.findOne({ where: { name: data.name, type: data.type } });
  if (existing) throw new ConflictError(`Category '${data.name}' (${data.type}) already exists`);
  return Category.create(data);
};

const update = async (id, data) => {
  const cat = await getById(id);
  await cat.update(data);
  return cat.reload();
};

const toggleStatus = async (id) => {
  const cat = await getById(id);
  await cat.update({ is_active: !cat.is_active });
  return cat.reload();
};

module.exports = { list, getById, create, update, toggleStatus };
