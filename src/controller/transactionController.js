const transactionService = require('../services/transactionService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/transactions
const list = async (req, res) => {
    const result = await transactionService.list(req.query);
    return sendSuccess(res, result.rows, 'Transactions fetched successfully', 200, result.meta);
};

// GET /api/v1/transactions/summary?from_date=&to_date=
const getSummary = async (req, res) => {
    const { from_date, to_date } = req.query;

    if (!from_date || !to_date) {
        return res.status(400).json({ success: false, message: 'from_date and to_date are required' });
    }

    const summary = await transactionService.getSummary({ from_date, to_date });
    return sendSuccess(res, summary, 'Transaction summary fetched successfully');
};

// GET /api/v1/transactions/:id
const getById = async (req, res) => {
    const transaction = await transactionService.getById(req.params.id);
    return sendSuccess(res, transaction, 'Transaction fetched successfully');
};

// POST /api/v1/transactions
const create = async (req, res) => {
    const transaction = await transactionService.create(req.body, req.user.id);
    return sendSuccess(res, transaction, 'Transaction created successfully', 201);
};

// PUT /api/v1/transactions/:id
const update = async (req, res) => {
    const transaction = await transactionService.update(req.params.id, req.body, req.user.id);
    return sendSuccess(res, transaction, 'Transaction updated successfully');
};

// DELETE /api/v1/transactions/:id
const remove = async (req, res) => {
    await transactionService.remove(req.params.id);
    return sendSuccess(res, null, 'Transaction deleted successfully');
};

module.exports = { list, getSummary, getById, create, update, remove };
