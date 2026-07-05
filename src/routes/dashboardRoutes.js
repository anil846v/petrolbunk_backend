const express = require('express');
const router  = express.Router();

const dashboardController = require('../controller/dashboardController');
const { authMiddleware }  = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/',                         dashboardController.getSummary);
router.get('/chart/fuel-trend',         dashboardController.getFuelTrend);
router.get('/chart/income-expense',     dashboardController.getIncomeExpenseTrend);

module.exports = router;
