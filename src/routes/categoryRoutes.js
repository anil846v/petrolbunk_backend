const express = require('express');
const router  = express.Router();

const categoryController                  = require('../controller/categoryController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

// All routes require login
router.use(authMiddleware);

router.get ('/',                    categoryController.list);
router.get ('/:id',                 categoryController.getById);

// Write operations — admin only
router.post('/',                    adminMiddleware, categoryController.create);
router.put ('/:id',                 adminMiddleware, categoryController.update);
router.patch('/:id/toggle-status',  adminMiddleware, categoryController.toggleStatus);

module.exports = router;
