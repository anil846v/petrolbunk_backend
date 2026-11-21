const express = require('express');
const router  = express.Router();

const loanTransactionController           = require('../controller/loanTransactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const validate                             = require('../middleware/validate');
const { createLoanTransactionSchema }      = require('../validators/loanTransactionValidator');

router.use(authMiddleware);

router.get ('/',       loanTransactionController.list);
router.get ('/:id',    loanTransactionController.getById);
router.post('/',       validate(createLoanTransactionSchema), loanTransactionController.create);
router.delete('/:id',  adminMiddleware, loanTransactionController.remove);

module.exports = router;
