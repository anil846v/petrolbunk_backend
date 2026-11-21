const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const paymentModes = ['CASH', 'BANK', 'UPI'];
const referenceTypes = ['FUEL', 'LOAN', 'MANUAL', 'SHIFT_EXPENSE'];

const createTransactionSchema = Joi.object({
  transaction_date: Joi.string().pattern(datePattern).required().messages({
    'string.pattern.base': 'transaction_date must be in YYYY-MM-DD format',
    'any.required': 'transaction_date is required',
  }),
  category_id: Joi.number().integer().positive().required().messages({
    'any.required': 'category_id is required',
    'number.positive': 'category_id must be a valid ID',
  }),
  vendor_id: Joi.number().integer().positive().allow(null).optional(),
  amount: Joi.number().min(0.01).required().messages({
    'number.min': 'Amount must be at least 0.01',
    'any.required': 'Amount is required',
  }),
  payment_mode: Joi.string().valid(...paymentModes).default('CASH').messages({
    'any.only': 'payment_mode must be one of: CASH, BANK, UPI',
  }),
  reference_type: Joi.string().valid(...referenceTypes).default('MANUAL'),
  reference_id: Joi.number().integer().positive().allow(null).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
});

const updateTransactionSchema = Joi.object({
  transaction_date: Joi.string().pattern(datePattern).optional(),
  category_id: Joi.number().integer().positive().optional(),
  vendor_id: Joi.number().integer().positive().allow(null).optional(),
  amount: Joi.number().min(0.01).optional(),
  payment_mode: Joi.string().valid(...paymentModes).optional(),
  description: Joi.string().trim().max(1000).allow('', null).optional(),
}).min(1);

module.exports = {
  createTransactionSchema,
  updateTransactionSchema,
};
