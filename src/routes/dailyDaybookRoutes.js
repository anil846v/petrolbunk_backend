const express = require('express');
const router  = express.Router();

const dailyDaybookController               = require('../controller/dailyDaybookController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const validate                             = require('../middleware/validate');
const { saveDaySchema }                    = require('../validators/dailyDaybookValidator');

router.use(authMiddleware);

router.get('/rates/latest',       dailyDaybookController.getLatestRates);
router.get('/rates/date/:date',   dailyDaybookController.getRateByDate);
router.post('/rates/fetch-live',  dailyDaybookController.fetchLiveRates);
router.get('/rates/history',      dailyDaybookController.getRateHistory);
router.get('/date/:date',         dailyDaybookController.getByDate);
router.post('/',                  validate(saveDaySchema), dailyDaybookController.saveDay);
router.get('/history',            dailyDaybookController.listHistory);
router.delete('/date/:date',      adminMiddleware, dailyDaybookController.deleteDay);

module.exports = router;
