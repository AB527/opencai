const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./administrators.controller');
const { createAdministratorSchema } = require('./administrators.schemas');

const router = express.Router();

router.get('/', controller.list);
router.post('/', validate(createAdministratorSchema), controller.create);
router.delete('/:id', controller.remove);

module.exports = router;
