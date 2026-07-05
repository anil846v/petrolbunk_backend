const loanService = require('../services/loanService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/loans
const list = async (req, res) => {
    const result = await loanService.list(req.query);
    return sendSuccess(res, result.rows, 'Loans fetched successfully', 200, result.meta);
};

// GET /api/v1/loans/outstanding
const getOutstanding = async (req, res) => {
    const result = await loanService.getOutstanding(req.query);
    return sendSuccess(res, result.rows, 'Outstanding loans fetched successfully', 200, result.meta);
};

// GET /api/v1/loans/:id
const getById = async (req, res) => {
    const loan = await loanService.getById(req.params.id);
    return sendSuccess(res, loan, 'Loan fetched successfully');
};

// GET /api/v1/loans/:id/ledger
const getLedger = async (req, res) => {
    const ledger = await loanService.getLedger(req.params.id);
    return sendSuccess(res, ledger, 'Loan ledger fetched successfully');
};

// POST /api/v1/loans
const create = async (req, res) => {
    const loan = await loanService.create(req.body, req.user.id);
    return sendSuccess(res, loan, 'Loan created successfully', 201);
};

// PUT /api/v1/loans/:id
const update = async (req, res) => {
    const loan = await loanService.update(req.params.id, req.body);
    return sendSuccess(res, loan, 'Loan updated successfully');
};

// PATCH /api/v1/loans/:id/close
const close = async (req, res) => {
    const loan = await loanService.close(req.params.id);
    return sendSuccess(res, loan, 'Loan closed successfully');
};

module.exports = { list, getOutstanding, getById, getLedger, create, update, close };
