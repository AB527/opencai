const express = require('express');
const { validate } = require('../../middleware/validate');
const controller = require('./chat.controller');
const { createSessionSchema, sendMessageSchema, renameSessionSchema } = require('./chat.schemas');

const router = express.Router();

router.post('/sessions', validate(createSessionSchema), controller.create);
router.get('/sessions', controller.list);
router.get('/sessions/:id', controller.getOne);
router.patch('/sessions/:id', validate(renameSessionSchema), controller.rename);
router.post('/sessions/:id/messages', validate(sendMessageSchema), controller.sendMessage);
router.post('/sessions/:id/messages/:messageId/confirm', controller.confirmMessage);
router.post('/sessions/:id/messages/:messageId/cancel', controller.cancelMessage);

module.exports = router;
