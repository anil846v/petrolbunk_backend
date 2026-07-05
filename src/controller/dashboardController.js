const dashboardService = require('../services/dashboardService');
const { sendSuccess } = require('../utils/response');

// GET /api/v1/dashboard?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
const getSummary = async (req, res) => {
    const summary = await dashboardService.getSummary(req.query);
    return sendSuccess(res, summary, 'Dashboard summary fetched successfully');
};

// GET /api/v1/dashboard/chart/fuel-trend?days=7
const getFuelTrend = async (req, res) => {
    const days  = parseInt(req.query.days) || 7;
    const trend = await dashboardService.getFuelTrend(days);
    return sendSuccess(res, trend, 'Fuel trend fetched successfully');
};

// GET /api/v1/dashboard/chart/income-expense?days=30
const getIncomeExpenseTrend = async (req, res) => {
    const days  = parseInt(req.query.days) || 30;
    const trend = await dashboardService.getIncomeExpenseTrend(days);
    return sendSuccess(res, trend, 'Income vs expense trend fetched successfully');
};

module.exports = { getSummary, getFuelTrend, getIncomeExpenseTrend };
