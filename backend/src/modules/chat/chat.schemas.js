const { z } = require('zod');
const { CHAT_MODES, FINOPS_SUB_MODES } = require('../../constants/chatModes');

const createSessionSchema = z.object({
  workspaceId: z.string().min(1),
  mode: z.enum(Object.values(CHAT_MODES)),
  subMode: z.enum(Object.values(FINOPS_SUB_MODES)).optional(),
});

const sendMessageSchema = z.object({
  text: z.string().min(1).max(4000),
});

module.exports = { createSessionSchema, sendMessageSchema };
