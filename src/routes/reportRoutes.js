const express = require('express');
const router  = express.Router();

const reportController  = require('../controller/reportController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Fuel
router.get('/fuel/daily',           reportController.getFuelDaily);
router.get('/fuel/monthly',         reportController.getFuelMonthly);
router.get('/fuel/by-type',         reportController.getFuelByType);
router.get('/fuel/commission',      reportController.getFuelCommission);

// Financial
router.get('/financial/income-expense',  reportController.getIncomeExpense);
router.get('/financial/profit',          reportController.getProfit);
router.get('/financial/payment-mode',    reportController.getPaymentMode);

// Loans
router.get('/loans/active',         reportController.getLoansActive);
router.get('/loans/closed',         reportController.getLoansClosed);
router.get('/loans/interest',       reportController.getLoansInterest);

// Vendor
router.get('/vendor/:vendorId/ledger',  reportController.getVendorLedger);

// Transactions
router.get('/transactions/category-wise',  reportController.getCategoryWise);

// Combined Monthly Report
router.get('/monthly', reportController.getMonthlyReport);

module.exports = router;
