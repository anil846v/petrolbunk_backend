const express = require('express');
const router  = express.Router();

const vendorController                    = require('../controller/vendorController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',                    vendorController.list);
router.get ('/:id',                 vendorController.getById);
router.get ('/:id/ledger',          vendorController.getLedger);

router.post('/',                    vendorController.create);
router.put ('/:id',                 vendorController.update);
router.patch('/:id/toggle-status',  adminMiddleware, vendorController.toggleStatus);

module.exports = router;
