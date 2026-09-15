const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./chatSettings.controller');
const { updateChatSettingsSchema } = require('./chatSettings.schemas');
const personasRoute = require('./personas.route');

const router = express.Router();

router.get('/', controller.get);
router.put('/', validate(updateChatSettingsSchema), controller.update);
router.use('/personas', personasRoute);

module.exports = router;
