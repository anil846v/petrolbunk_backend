const express = require('express');
const router  = express.Router();

const fuelTypeController                  = require('../controller/fuelTypeController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',                    fuelTypeController.list);
router.get ('/active-on/:date',     fuelTypeController.getActiveOn);
router.get ('/:id',                 fuelTypeController.getById);

router.post('/',                    adminMiddleware, fuelTypeController.create);
router.put ('/:id',                 adminMiddleware, fuelTypeController.update);
router.patch('/:id/toggle-status',  adminMiddleware, fuelTypeController.toggleStatus);

module.exports = router;
