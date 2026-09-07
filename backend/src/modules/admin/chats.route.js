const express = require('express');
const controller = require('./chats.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id/messages', controller.messages);

module.exports = router;
