const express = require('express');
const router  = express.Router();

const transactionController               = require('../controller/transactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get ('/',           transactionController.list);
router.get ('/summary',    transactionController.getSummary);
router.get ('/:id',        transactionController.getById);
router.post('/',           transactionController.create);
router.put ('/:id',        transactionController.update);
router.delete('/:id',      adminMiddleware, transactionController.remove);

module.exports = router;
