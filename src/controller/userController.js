const userService = require('../services/userService');
const { sendSuccess, sendError } = require('../utils/response');

// GET /api/v1/users
const list = async (req, res) => {
    const result = await userService.list(req.query);
    return sendSuccess(res, result.rows, 'Users fetched successfully', 200, result.meta);
};

// GET /api/v1/users/:id
const getById = async (req, res) => {
    const user = await userService.getById(req.params.id);
    return sendSuccess(res, user, 'User fetched successfully');
};

// POST /api/v1/users
const create = async (req, res) => {
    const user = await userService.create(req.body);
    return sendSuccess(res, user, 'User created successfully', 201);
};

// PUT /api/v1/users/:id
const update = async (req, res) => {
    const user = await userService.update(req.params.id, req.body);
    return sendSuccess(res, user, 'User updated successfully');
};

// PATCH /api/v1/users/:id/toggle-status
const toggleStatus = async (req, res) => {
    const user = await userService.toggleStatus(req.params.id);
    const msg  = user.is_active ? 'User activated' : 'User deactivated';
    return sendSuccess(res, user, msg);
};

// PATCH /api/v1/users/:id/reset-password
const resetPassword = async (req, res) => {
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
        return sendError(res, 'New password must be at least 6 characters', 400);
    }

    await userService.resetPassword(req.params.id, new_password);
    return sendSuccess(res, null, 'Password reset successfully');
};

module.exports = { list, getById, create, update, toggleStatus, resetPassword };
