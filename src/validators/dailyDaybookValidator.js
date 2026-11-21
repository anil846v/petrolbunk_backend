const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const numField = Joi.number().min(0).allow('', null).empty('').default(0);
const nullableNum = Joi.number().min(0).allow('', null).empty('').default(null);

const saveDaySchema = Joi.object({
  entry_date: Joi.string().pattern(datePattern).required().messages({
    'string.pattern.base': 'entry_date must be in YYYY-MM-DD format',
    'any.required': 'entry_date is required',
  }),

  // Petrol (MS)
  ms_price: Joi.number().positive().allow('', null).empty('').default(104.50),
  ms_open: numField,
  ms_close: numField,
  ms_sold: numField,
  ms_amount: numField,
  ms_dip_open: nullableNum,
  ms_dip_close: nullableNum,
  ms_dip_diff: Joi.number().allow('', null).empty('').default(0),
  ms_margin: Joi.number().min(0).allow('', null).empty('').default(3.50),

  // Diesel (HSD)
  hsd_price: Joi.number().positive().allow('', null).empty('').default(91.20),
  hsd_open: numField,
  hsd_close: numField,
  hsd_sold: numField,
  hsd_amount: numField,
  hsd_dip_open: nullableNum,
  hsd_dip_close: nullableNum,
  hsd_dip_diff: Joi.number().allow('', null).empty('').default(0),
  hsd_margin: Joi.number().min(0).allow('', null).empty('').default(3.00),

  // Collections
  total_sales: numField,
  cash_collected: numField,
  upi_collected: numField,
  card_collected: numField,
  credit_collected: numField,
  total_collected: numField,
  short_excess: Joi.number().allow('', null).empty('').default(0),
  total_margin: numField,

  // Expenses list
  expenses: Joi.array().items(
    Joi.object({
      id: Joi.any().optional(),
      cat: Joi.string().trim().max(100).required().messages({
        'any.required': 'Expense category is required',
      }),
      desc: Joi.string().trim().max(255).allow('', null).default(''),
      to: Joi.string().trim().max(100).allow('', null).default(''),
      amt: Joi.number().positive().required().messages({
        'number.positive': 'Expense amount must be greater than zero',
        'any.required': 'Expense amount is required',
      }),
      vendor_id: Joi.number().integer().positive().allow(null).optional(),
      category_id: Joi.number().integer().positive().allow(null).optional(),
    })
  ).default([]),

  day_expenses: numField,
  net_amount: Joi.number().allow('', null).empty('').default(0),
  net_profit: Joi.number().allow('', null).empty('').default(0),
  notes: Joi.string().trim().max(1000).allow('', null).default(null),
});

module.exports = { saveDaySchema };
