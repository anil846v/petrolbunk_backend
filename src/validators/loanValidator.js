const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const createLoanSchema = Joi.object({
  vendor_id: Joi.number().integer().positive().required().messages({
    'any.required': 'vendor_id is required',
    'number.positive': 'vendor_id must be a valid ID',
  }),
  loan_type: Joi.string().valid('GIVEN', 'TAKEN').required().messages({
    'any.only': 'loan_type must be either GIVEN or TAKEN',
    'any.required': 'loan_type is required',
  }),
  principal_amount: Joi.number().min(0.01).required().messages({
    'number.min': 'principal_amount must be at least 0.01',
    'any.required': 'principal_amount is required',
  }),
  interest_percent: Joi.number().min(0).max(100).allow('', null).empty('').default(0),
  start_date: Joi.string().pattern(datePattern).required().messages({
    'string.pattern.base': 'start_date must be in YYYY-MM-DD format',
    'any.required': 'start_date is required',
  }),
  end_date: Joi.string().pattern(datePattern).allow('', null).optional(),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
  remarks: Joi.string().trim().max(1000).allow('', null).optional(),
});

const updateLoanSchema = Joi.object({
  principal_amount: Joi.number().min(0.01).optional(),
  interest_percent: Joi.number().min(0).max(100).allow('', null).optional(),
  start_date: Joi.string().pattern(datePattern).optional(),
  end_date: Joi.string().pattern(datePattern).allow('', null).optional(),
  notes: Joi.string().trim().max(1000).allow('', null).optional(),
  remarks: Joi.string().trim().max(1000).allow('', null).optional(),
}).min(1);

module.exports = {
  createLoanSchema,
  updateLoanSchema,
};
