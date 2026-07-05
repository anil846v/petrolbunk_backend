const express = require('express');
const router  = express.Router();

const fuelSaleController                  = require('../controller/fuelSaleController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',                fuelSaleController.list);
router.get ('/date/:date',      fuelSaleController.getByDate);
router.get ('/:id',             fuelSaleController.getById);
router.post('/',                fuelSaleController.create);
router.put ('/:id',             fuelSaleController.update);
router.delete('/:id',           adminMiddleware, fuelSaleController.remove);

module.exports = router;
