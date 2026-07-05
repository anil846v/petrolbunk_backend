const loanTransactionService = require('../services/loanTransactionService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/loan-transactions
const list = async (req, res) => {
    const result = await loanTransactionService.list(req.query);
    return sendSuccess(res, result.rows, 'Loan transactions fetched successfully', 200, result.meta);
};

// GET /api/v1/loan-transactions/:id
const getById = async (req, res) => {
    const lt = await loanTransactionService.getById(req.params.id);
    return sendSuccess(res, lt, 'Loan transaction fetched successfully');
};

// POST /api/v1/loan-transactions
const create = async (req, res) => {
    const lt = await loanTransactionService.create(req.body, req.user.id);
    return sendSuccess(res, lt, 'Loan transaction recorded successfully', 201);
};

// DELETE /api/v1/loan-transactions/:id
const remove = async (req, res) => {
    await loanTransactionService.remove(req.params.id);
    return sendSuccess(res, null, 'Loan transaction deleted successfully');
};

module.exports = { list, getById, create, remove };
