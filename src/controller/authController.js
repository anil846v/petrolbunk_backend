const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');

// POST /api/v1/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendError(res, 'Email and password are required', 400);
    }

    const { token, profile } = await authService.login(email, password);

    res.cookie('token', token, authService.COOKIE_OPTIONS);

    return sendSuccess(res, profile, 'Login successful');
};

// POST /api/v1/auth/logout
const logout = async (req, res) => {
    res.clearCookie('token', { path: '/' });
    return sendSuccess(res, null, 'Logged out successfully');
};

// GET /api/v1/auth/me
const getMe = async (req, res) => {
    const user = await authService.getCurrentUser(req.user.id);
    return sendSuccess(res, user, 'User fetched successfully');
};

module.exports = { login, logout, getMe };
