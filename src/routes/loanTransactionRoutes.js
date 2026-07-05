const express = require('express');
const router  = express.Router();

const loanTransactionController           = require('../controller/loanTransactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',       loanTransactionController.list);
router.get ('/:id',    loanTransactionController.getById);
router.post('/',       loanTransactionController.create);
router.delete('/:id',  adminMiddleware, loanTransactionController.remove);

module.exports = router;
