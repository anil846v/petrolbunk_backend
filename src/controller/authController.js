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

// POST /api/v1/auth/forgot-password
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return sendSuccess(res, result, 'Verification code has been sent to your registered email.');
};

// POST /api/v1/auth/verify-otp
const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;
    const result = await authService.verifyOtp({ email, otp });
    return sendSuccess(res, result, 'Verification code confirmed. You can now set a new password.');
};

// POST /api/v1/auth/reset-password
const resetPassword = async (req, res) => {
    const { email, otp, new_password } = req.body;
    const result = await authService.resetPassword({ email, otp, new_password });
    return sendSuccess(res, result, 'Password reset successful. You can now login with your new password.');
};

module.exports = { login, logout, getMe, forgotPassword, verifyOtp, resetPassword };
