const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./personas.controller');
const { upsertPersonaSchema } = require('./personas.schemas');

const router = express.Router();

router.get('/', controller.list);
router.put('/', validate(upsertPersonaSchema), controller.upsert);

module.exports = router;
