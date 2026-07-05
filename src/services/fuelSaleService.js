const { FuelSale, FuelType, Category, Transaction } = require('../models');
const { Op } = require('sequelize');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/AppError');
const { getPagination, buildMeta, getSortOrder } = require('../utils/pagination');
const transactionService = require('./transactionService');
const sequelize = require('../config/database');

const SORTABLE = ['sale_date', 'litres_sold', 'sales_amount', 'created_at'];

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const order = getSortOrder(query, SORTABLE, 'sale_date');

  const where = {};
  if (query.fuel_type_id) where.fuel_type_id = query.fuel_type_id;
  if (query.from_date || query.to_date) {
    where.sale_date = {};
    if (query.from_date) where.sale_date[Op.gte] = query.from_date;
    if (query.to_date)   where.sale_date[Op.lte] = query.to_date;
  }

  const { rows, count } = await FuelSale.findAndCountAll({
    where, limit, offset, order,
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
  });

  return { rows, meta: buildMeta(count, page, limit) };
};

const getByDate = async (date) => {
  return FuelSale.findAll({
    where:   { sale_date: date },
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code', 'price_per_litre'] }],
    order:   [['fuel_type_id', 'ASC']],
  });
};

const getById = async (id) => {
  const sale = await FuelSale.findByPk(id, {
    include: [{ model: FuelType, as: 'fuelType', attributes: ['id', 'fuel_type', 'code'] }],
  });
  if (!sale) throw new NotFoundError('Fuel sale record not found');
  return sale;
};

/**
 * Computes sales_amount and commission_amount from the fuel type's rates.
 * litres_sold is a DB-generated column (closing_meter - opening_meter),
 * but we calculate it here for the amount computation before the INSERT.
 */
const computeAmounts = (openingMeter, closingMeter, fuelType) => {
  const litresSold = parseFloat(closingMeter) - parseFloat(openingMeter);
  if (litresSold < 0) throw new ValidationError('Closing meter must be greater than opening meter');

  const salesAmount = litresSold * parseFloat(fuelType.price_per_litre || 0);

  let commissionAmount = 0;
  if (fuelType.commission_type === 'AMOUNT' && fuelType.commission_value) {
    commissionAmount = litresSold * parseFloat(fuelType.commission_value);
  } else if (fuelType.commission_type === 'PERCENT' && fuelType.commission_value) {
    commissionAmount = (salesAmount * parseFloat(fuelType.commission_value)) / 100;
  }

  return { salesAmount, commissionAmount };
};

/**
 * Find-or-create a "Fuel Sales" INCOME category for Day Book mirroring.
 */
const getFuelCategory = async () => {
  const [cat] = await Category.findOrCreate({
    where:    { name: 'Fuel Sales', type: 'INCOME' },
    defaults: { name: 'Fuel Sales', type: 'INCOME', is_active: true },
  });
  return cat;
};

/**
 * Creates a fuel sale and atomically mirrors it into the Day Book (transactions table)
 * as a FUEL INCOME entry so it appears in Daybook and dashboard totals.
 */
const create = async (data, createdBy) => {
  const existing = await FuelSale.findOne({
    where: { sale_date: data.sale_date, fuel_type_id: data.fuel_type_id },
  });
  if (existing) {
    throw new ConflictError(
      'A fuel sale entry for this fuel type on this date already exists. Use update instead.'
    );
  }

  const fuelType = await FuelType.findByPk(data.fuel_type_id);
  if (!fuelType) throw new NotFoundError('Fuel type not found');
  if (!fuelType.is_active) throw new ValidationError('This fuel type is inactive');

  const { salesAmount, commissionAmount } = computeAmounts(
    data.opening_meter, data.closing_meter, fuelType
  );

  // If commission is zero there is nothing to mirror into the Day Book
  if (commissionAmount <= 0) {
    const sale = await FuelSale.create({
      sale_date:         data.sale_date,
      fuel_type_id:      data.fuel_type_id,
      opening_meter:     data.opening_meter,
      closing_meter:     data.closing_meter,
      opening_dip:       data.opening_dip ?? null,
      closing_dip:       data.closing_dip ?? null,
      sales_amount:      salesAmount,
      commission_amount: commissionAmount,
      remarks:           data.remarks ?? null,
      created_by:        createdBy ?? null,
    });
    return getById(sale.id);
  }

  const category = await getFuelCategory();
  const t = await sequelize.transaction();

  try {
    const sale = await FuelSale.create(
      {
        sale_date:         data.sale_date,
        fuel_type_id:      data.fuel_type_id,
        opening_meter:     data.opening_meter,
        closing_meter:     data.closing_meter,
        opening_dip:       data.opening_dip ?? null,
        closing_dip:       data.closing_dip ?? null,
        sales_amount:      salesAmount,
        commission_amount: commissionAmount,
        remarks:           data.remarks ?? null,
        created_by:        createdBy ?? null,
      },
      { transaction: t }
    );

    // Mirror into Day Book as a FUEL INCOME entry (only commission, not sales amount)
    await transactionService.create(
      {
        transaction_date: data.sale_date,
        category_id:      category.id,
        vendor_id:        null,
        amount:           commissionAmount,
        payment_mode:     data.payment_mode || 'CASH',
        reference_type:   'FUEL',
        reference_id:     sale.id,
        description:      `Fuel commission — ${fuelType.fuel_type}`,
      },
      createdBy,
      t
    );

    await t.commit();
    return getById(sale.id);
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

const update = async (id, data, updatedBy) => {
  const sale = await getById(id);

  // Re-compute amounts if meter readings changed
  if (data.opening_meter !== undefined || data.closing_meter !== undefined) {
    const newOpen  = data.opening_meter ?? parseFloat(sale.opening_meter);
    const newClose = data.closing_meter ?? parseFloat(sale.closing_meter);
    const fuelType = await FuelType.findByPk(data.fuel_type_id ?? sale.fuel_type_id);

    const { salesAmount, commissionAmount } = computeAmounts(newOpen, newClose, fuelType);
    data.sales_amount      = salesAmount;
    data.commission_amount = commissionAmount;

    // Keep the mirrored Day Book entry in sync (only commission, not sales amount)
    await Transaction.update(
      { amount: commissionAmount, updated_by: updatedBy ?? null },
      { where: { reference_type: 'FUEL', reference_id: sale.id } }
    );
  }

  await sale.update(data);
  return getById(id);
};

const remove = async (id) => {
  const sale = await getById(id);

  const t = await sequelize.transaction();
  try {
    // Remove the mirrored Day Book entry created when this sale was recorded
    await Transaction.destroy({
      where:       { reference_type: 'FUEL', reference_id: sale.id },
      transaction: t,
    });
    await sale.destroy({ transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

module.exports = { list, getByDate, getById, create, update, remove };
