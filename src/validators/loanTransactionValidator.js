const Joi = require('joi');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const paymentModes = ['CASH', 'BANK', 'UPI'];
const txnTypes = ['DISBURSEMENT', 'REPAYMENT'];

const createLoanTransactionSchema = Joi.object({
  loan_id: Joi.number().integer().positive().required().messages({
    'any.required': 'loan_id is required',
    'number.positive': 'loan_id must be a valid ID',
  }),
  type: Joi.string().valid(...txnTypes).required().messages({
    'any.only': 'type must be either DISBURSEMENT or REPAYMENT',
    'any.required': 'type is required',
  }),
  amount: Joi.number().min(0.01).required().messages({
    'number.min': 'Amount must be at least 0.01',
    'any.required': 'Amount is required',
  }),
  transaction_date: Joi.string().pattern(datePattern).required().messages({
    'string.pattern.base': 'transaction_date must be in YYYY-MM-DD format',
    'any.required': 'transaction_date is required',
  }),
  payment_mode: Joi.string().valid(...paymentModes).default('CASH').messages({
    'any.only': 'payment_mode must be one of: CASH, BANK, UPI',
  }),
  category_id: Joi.number().integer().positive().allow(null).optional(),
  remarks: Joi.string().trim().max(1000).allow('', null).optional(),
});

module.exports = {
  createLoanTransactionSchema,
};
