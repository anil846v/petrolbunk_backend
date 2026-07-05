const fuelSaleService = require('../services/fuelSaleService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/fuel-sales
const list = async (req, res) => {
    const result = await fuelSaleService.list(req.query);
    return sendSuccess(res, result.rows, 'Fuel sales fetched successfully', 200, result.meta);
};

// GET /api/v1/fuel-sales/date/:date
const getByDate = async (req, res) => {
    const sales = await fuelSaleService.getByDate(req.params.date);
    return sendSuccess(res, sales, 'Fuel sales for date fetched successfully');
};

// GET /api/v1/fuel-sales/:id
const getById = async (req, res) => {
    const sale = await fuelSaleService.getById(req.params.id);
    return sendSuccess(res, sale, 'Fuel sale fetched successfully');
};

// POST /api/v1/fuel-sales
const create = async (req, res) => {
    const sale = await fuelSaleService.create(req.body, req.user.id);
    return sendSuccess(res, sale, 'Fuel sale created successfully', 201);
};

// PUT /api/v1/fuel-sales/:id
const update = async (req, res) => {
    const sale = await fuelSaleService.update(req.params.id, req.body, req.user.id);
    return sendSuccess(res, sale, 'Fuel sale updated successfully');
};

// DELETE /api/v1/fuel-sales/:id
const remove = async (req, res) => {
    await fuelSaleService.remove(req.params.id);
    return sendSuccess(res, null, 'Fuel sale deleted successfully');
};

module.exports = { list, getByDate, getById, create, update, remove };
