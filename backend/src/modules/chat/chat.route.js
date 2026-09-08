const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./chat.controller');
const { createSessionSchema } = require('./chat.schemas');

const router = express.Router();

router.post('/sessions', validate(createSessionSchema), controller.create);
router.get('/sessions', controller.list);
router.get('/sessions/:id', controller.getOne);

module.exports = router;
