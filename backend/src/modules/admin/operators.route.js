const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./operators.controller');
const { createOperatorSchema, updateOperatorSchema } = require('./operators.schemas');

const router = express.Router();

router.get('/', controller.list);
router.post('/', validate(createOperatorSchema), controller.create);
router.patch('/:id', validate(updateOperatorSchema), controller.update);
router.post('/:id/deactivate', controller.deactivate);
router.delete('/:id', controller.remove);

module.exports = router;
