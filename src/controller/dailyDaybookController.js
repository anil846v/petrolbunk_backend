const dailyDaybookService = require('../services/dailyDaybookService');
const fuelRateService     = require('../services/fuelRateService');
const { sendSuccess }     = require('../utils/response');

// GET /api/v1/daily-daybook/date/:date
const getByDate = async (req, res, next) => {
  try {
    const result = await dailyDaybookService.getByDate(req.params.date);
    return sendSuccess(res, result, 'Day Book fetched successfully');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/daily-daybook
const saveDay = async (req, res, next) => {
  try {
    const result = await dailyDaybookService.saveDay(req.body, req.user?.id);
    return sendSuccess(res, result, 'Day Book saved successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/daily-daybook/history?month=YYYY-MM or from_date=&to_date=
const listHistory = async (req, res, next) => {
  try {
    const result = await dailyDaybookService.listHistory(req.query);
    return sendSuccess(res, result, 'History fetched successfully');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/daily-daybook/date/:date
const deleteDay = async (req, res, next) => {
  try {
    const result = await dailyDaybookService.deleteDay(req.params.date);
    return sendSuccess(res, result, 'Day Book entry deleted successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/daily-daybook/rates/latest
const getLatestRates = async (req, res, next) => {
  try {
    const city = req.query.city;
    const result = await fuelRateService.getLatestRates({ city });
    return sendSuccess(res, result, 'Latest fuel rates fetched');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/daily-daybook/rates/date/:date
const getRateByDate = async (req, res, next) => {
  try {
    const result = await fuelRateService.getRateByDate(req.params.date);
    return sendSuccess(res, result, 'Fuel rates for date fetched');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/daily-daybook/rates/fetch-live
const fetchLiveRates = async (req, res, next) => {
  try {
    const city = req.body?.city || req.query?.city;
    const rates = await fuelRateService.fetchLiveMarketRates(city);
    if (!rates) {
      // Graceful fallback to latest system rates
      const fallback = await fuelRateService.getLatestRates({ live: false, city });
      return sendSuccess(res, { ...fallback, live_fetched: false }, 'Using cached rates (live feed unavailable)');
    }
    return sendSuccess(res, { ...rates, live_fetched: true }, 'Live fuel rates fetched successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/daily-daybook/rates/history
const getRateHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const result = await fuelRateService.getRateHistory(limit);
    return sendSuccess(res, result, 'Fuel rate history fetched');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getByDate,
  saveDay,
  listHistory,
  deleteDay,
  getLatestRates,
  getRateByDate,
  fetchLiveRates,
  getRateHistory,
};
