const categoryService = require('../services/categoryService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/categories
const list = async (req, res) => {
    const result = await categoryService.list(req.query);
    return sendSuccess(res, result.rows, 'Categories fetched successfully', 200, result.meta);
};

// GET /api/v1/categories/:id
const getById = async (req, res) => {
    const category = await categoryService.getById(req.params.id);
    return sendSuccess(res, category, 'Category fetched successfully');
};

// POST /api/v1/categories
const create = async (req, res) => {
    const category = await categoryService.create(req.body);
    return sendSuccess(res, category, 'Category created successfully', 201);
};

// PUT /api/v1/categories/:id
const update = async (req, res) => {
    const category = await categoryService.update(req.params.id, req.body);
    return sendSuccess(res, category, 'Category updated successfully');
};

// PATCH /api/v1/categories/:id/toggle-status
const toggleStatus = async (req, res) => {
    const category = await categoryService.toggleStatus(req.params.id);
    const msg      = category.is_active ? 'Category activated' : 'Category deactivated';
    return sendSuccess(res, category, msg);
};

module.exports = { list, getById, create, update, toggleStatus };
