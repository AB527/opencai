const express = require('express');
const administratorsRoute = require('./administrators.route');
const operatorsRoute = require('./operators.route');
const organisationsRoute = require('./organisations.route');
const chatSettingsRoute = require('./chatSettings.route');
const brandingRoute = require('./branding.route');
const chatsRoute = require('./chats.route');

const router = express.Router();

router.use('/administrators', administratorsRoute);
router.use('/operators', operatorsRoute);
router.use('/organisations', organisationsRoute);
router.use('/chat-settings', chatSettingsRoute);
router.use('/branding', brandingRoute);
router.use('/chats', chatsRoute);

module.exports = router;
