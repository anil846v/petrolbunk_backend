const reportService = require('../services/reportService');
const { sendSuccess, sendError } = require('../utils/response');

// Helper — enforces that both date params are present
const requireDates = (req, res) => {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
        sendError(res, 'from_date and to_date are required', 400);
        return false;
    }
    return { from_date, to_date };
};

// ── Fuel Reports ──────────────────────────────────────────────────────────────

// GET /api/v1/reports/fuel/daily?from_date=&to_date=&fuel_type_id=
const getFuelDaily = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getFuelDaily({ ...dates, fuel_type_id: req.query.fuel_type_id });
    return sendSuccess(res, rows, 'Daily fuel report fetched successfully');
};

// GET /api/v1/reports/fuel/monthly?from_date=&to_date=
const getFuelMonthly = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getFuelMonthly(dates);
    return sendSuccess(res, rows, 'Monthly fuel report fetched successfully');
};

// GET /api/v1/reports/fuel/by-type?from_date=&to_date=
const getFuelByType = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getFuelByType(dates);
    return sendSuccess(res, rows, 'Fuel-wise report fetched successfully');
};

// GET /api/v1/reports/fuel/commission?from_date=&to_date=&fuel_type_id=
const getFuelCommission = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const result = await reportService.getFuelCommission({ ...dates, fuel_type_id: req.query.fuel_type_id });
    return sendSuccess(res, result, 'Commission report fetched successfully');
};

// ── Financial Reports ─────────────────────────────────────────────────────────

// GET /api/v1/reports/financial/income-expense?from_date=&to_date=&type=
const getIncomeExpense = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getIncomeExpense({ ...dates, type: req.query.type });
    return sendSuccess(res, rows, 'Income/expense report fetched successfully');
};

// GET /api/v1/reports/financial/profit?from_date=&to_date=
const getProfit = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const result = await reportService.getProfit(dates);
    return sendSuccess(res, result, 'Profit report fetched successfully');
};

// GET /api/v1/reports/financial/payment-mode?from_date=&to_date=
const getPaymentMode = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getPaymentMode(dates);
    return sendSuccess(res, rows, 'Payment mode report fetched successfully');
};

// ── Loan Reports ──────────────────────────────────────────────────────────────

// GET /api/v1/reports/loans/active?loan_type=
const getLoansActive = async (req, res) => {
    const rows = await reportService.getLoansActive({ loan_type: req.query.loan_type });
    return sendSuccess(res, rows, 'Active loans report fetched successfully');
};

// GET /api/v1/reports/loans/closed?loan_type=
const getLoansClosed = async (req, res) => {
    const rows = await reportService.getLoansClosed({ loan_type: req.query.loan_type });
    return sendSuccess(res, rows, 'Closed loans report fetched successfully');
};

// GET /api/v1/reports/loans/interest
const getLoansInterest = async (req, res) => {
    const rows = await reportService.getLoansInterest();
    return sendSuccess(res, rows, 'Loan interest report fetched successfully');
};

// ── Vendor Reports ────────────────────────────────────────────────────────────

// GET /api/v1/reports/vendor/:vendorId/ledger?from_date=&to_date=
const getVendorLedger = async (req, res) => {
    const result = await reportService.getVendorLedger(req.params.vendorId, req.query);
    if (!result) return sendError(res, 'Vendor not found', 404);
    return sendSuccess(res, result, 'Vendor ledger fetched successfully');
};

// GET /api/v1/reports/transactions/category-wise?from_date=&to_date=&type=
const getCategoryWise = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const rows = await reportService.getCategoryWise({ ...dates, type: req.query.type });
    return sendSuccess(res, rows, 'Category-wise report fetched successfully');
};

// GET /api/v1/reports/monthly?from_date=&to_date=
const getMonthlyReport = async (req, res) => {
    const dates = requireDates(req, res);
    if (!dates) return;

    const report = await reportService.getMonthlyReport(dates);
    return sendSuccess(res, report, 'Monthly report fetched successfully');
};

module.exports = {
    getFuelDaily,
    getFuelMonthly,
    getFuelByType,
    getFuelCommission,
    getIncomeExpense,
    getProfit,
    getPaymentMode,
    getLoansActive,
    getLoansClosed,
    getLoansInterest,
    getVendorLedger,
    getCategoryWise,
    getMonthlyReport,
};
