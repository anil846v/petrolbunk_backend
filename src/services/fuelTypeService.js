const { FuelType } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError } = require('../utils/AppError');
const { getPagination, buildMeta } = require('../utils/pagination');

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);

  const where = {};
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true' || query.is_active === true;
  if (query.search) where[Op.or] = [
    { fuel_type: { [Op.like]: `%${query.search}%` } },
    { code:      { [Op.like]: `%${query.search}%` } },
  ];

  const { rows, count } = await FuelType.findAndCountAll({
    where, limit, offset,
    order: [['fuel_type', 'ASC']],
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

/**
 * Returns all fuel types whose price period covers the given date.
 * Used by FuelSaleService to fetch the price active on a specific sale date.
 */
const getActiveOn = async (date) => {
  return FuelType.findAll({
    where: {
      is_active:  true,
      from_date:  { [Op.lte]: date },
      [Op.or]: [
        { to_date: null },
        { to_date: { [Op.gte]: date } },
      ],
    },
  });
};

const getById = async (id) => {
  const ft = await FuelType.findByPk(id);
  if (!ft) throw new NotFoundError('Fuel type not found');
  return ft;
};

const getByCode = async (code) => {
  const ft = await FuelType.findOne({ where: { code } });
  if (!ft) throw new NotFoundError(`Fuel type with code '${code}' not found`);
  return ft;
};

const create = async (data) => {
  const clash = await FuelType.findOne({ where: { code: data.code.toUpperCase() } });
  if (clash) throw new ConflictError(`Fuel type with code '${data.code}' already exists`);
  return FuelType.create({ ...data, code: data.code.toUpperCase() });
};

const update = async (id, data) => {
  const ft = await getById(id);
  await ft.update(data);
  return ft.reload();
};

const toggleStatus = async (id) => {
  const ft = await getById(id);
  await ft.update({ is_active: !ft.is_active });
  return ft.reload();
};

module.exports = { list, getActiveOn, getById, getByCode, create, update, toggleStatus };
