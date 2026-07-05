const express = require('express');
const router  = express.Router();

const userController                       = require('../controller/userController');
const { authMiddleware, adminMiddleware }  = require('../middleware/authMiddleware');

// All user routes require login + admin role
router.use(authMiddleware, adminMiddleware);

router.get ('/',                        userController.list);
router.post('/',                        userController.create);
router.get ('/:id',                     userController.getById);
router.put ('/:id',                     userController.update);
router.patch('/:id/toggle-status',      userController.toggleStatus);
router.patch('/:id/reset-password',     userController.resetPassword);

module.exports = router;
