const fuelTypeService = require('../services/fuelTypeService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/fuel-types
const list = async (req, res) => {
    const result = await fuelTypeService.list(req.query);
    return sendSuccess(res, result.rows, 'Fuel types fetched successfully', 200, result.meta);
};

// GET /api/v1/fuel-types/active-on/:date
const getActiveOn = async (req, res) => {
    const fuelTypes = await fuelTypeService.getActiveOn(req.params.date);
    return sendSuccess(res, fuelTypes, 'Active fuel types fetched successfully');
};

// GET /api/v1/fuel-types/:id
const getById = async (req, res) => {
    const fuelType = await fuelTypeService.getById(req.params.id);
    return sendSuccess(res, fuelType, 'Fuel type fetched successfully');
};

// POST /api/v1/fuel-types
const create = async (req, res) => {
    const fuelType = await fuelTypeService.create(req.body);
    return sendSuccess(res, fuelType, 'Fuel type created successfully', 201);
};

// PUT /api/v1/fuel-types/:id
const update = async (req, res) => {
    const fuelType = await fuelTypeService.update(req.params.id, req.body);
    return sendSuccess(res, fuelType, 'Fuel type updated successfully');
};

// PATCH /api/v1/fuel-types/:id/toggle-status
const toggleStatus = async (req, res) => {
    const fuelType = await fuelTypeService.toggleStatus(req.params.id);
    const msg      = fuelType.is_active ? 'Fuel type activated' : 'Fuel type deactivated';
    return sendSuccess(res, fuelType, msg);
};

module.exports = { list, getActiveOn, getById, create, update, toggleStatus };
