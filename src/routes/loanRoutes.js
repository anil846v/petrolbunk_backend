const express = require('express');
const router  = express.Router();

const loanController  = require('../controller/loanController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',                loanController.list);
router.get ('/outstanding',     loanController.getOutstanding);
router.get ('/:id',             loanController.getById);
router.get ('/:id/ledger',      loanController.getLedger);
router.post('/',                loanController.create);
router.put ('/:id',             loanController.update);
router.patch('/:id/close',      loanController.close);

module.exports = router;
