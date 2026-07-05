const express = require('express');
const router  = express.Router();

const authController     = require('../controller/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authLimiter }    = require('../middleware/rateLimiter');

// ── Public ────────────────────────────────────────────────────────────────────
router.post('/login',  authLimiter, authController.login);
router.post('/logout',              authController.logout);

// ── Protected ─────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, authController.getMe);

// ── Dev only — seed admin account ─────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
    const { User } = require('../models');
    router.get('/setup-admin', async (req, res) => {
        await User.destroy({ where: { email: 'admin@petrolbunk.com' } });
        await User.create({
            username:  'admin',
            email:     'admin@petrolbunk.com',
            password:  'Admin@123',
            phone_no:  '9177565639',
            role:      'ADMIN',
            is_active: true,
        });
        res.json({
            success:     true,
            message:     'Admin created',
            credentials: { email: 'admin@petrolbunk.com', password: 'Admin@123' },
        });
    });
}

module.exports = router;
