const vendorService = require('../services/vendorService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/vendors
const list = async (req, res) => {
    const result = await vendorService.list(req.query);
    return sendSuccess(res, result.rows, 'Vendors fetched successfully', 200, result.meta);
};

// GET /api/v1/vendors/:id
const getById = async (req, res) => {
    const vendor = await vendorService.getById(req.params.id);
    return sendSuccess(res, vendor, 'Vendor fetched successfully');
};

// POST /api/v1/vendors
const create = async (req, res) => {
    const vendor = await vendorService.create(req.body);
    return sendSuccess(res, vendor, 'Vendor created successfully', 201);
};

// PUT /api/v1/vendors/:id
const update = async (req, res) => {
    const vendor = await vendorService.update(req.params.id, req.body);
    return sendSuccess(res, vendor, 'Vendor updated successfully');
};

// PATCH /api/v1/vendors/:id/toggle-status
const toggleStatus = async (req, res) => {
    const vendor = await vendorService.toggleStatus(req.params.id);
    const msg    = vendor.is_active ? 'Vendor activated' : 'Vendor deactivated';
    return sendSuccess(res, vendor, msg);
};

// GET /api/v1/vendors/:id/ledger
const getLedger = async (req, res) => {
    const result = await vendorService.getLedger(req.params.id, req.query);
    return sendSuccess(res, result, 'Vendor ledger fetched successfully');
};

module.exports = { list, getById, create, update, toggleStatus, getLedger };
