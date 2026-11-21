const express = require('express');
const router  = express.Router();

const transactionController               = require('../controller/transactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const validate                             = require('../middleware/validate');
const { createTransactionSchema, updateTransactionSchema } = require('../validators/transactionValidator');

router.use(authMiddleware);

router.get ('/',           transactionController.list);
router.get ('/summary',    transactionController.getSummary);
router.get ('/:id',        transactionController.getById);
router.post('/',           validate(createTransactionSchema), transactionController.create);
router.put ('/:id',        validate(updateTransactionSchema), transactionController.update);
router.delete('/:id',      adminMiddleware, transactionController.remove);

module.exports = router;
