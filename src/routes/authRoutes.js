const express = require('express');
const router = express.Router();

const authController = require('../controller/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
