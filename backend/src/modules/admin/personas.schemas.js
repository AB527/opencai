const { z } = require('zod');
const { CHAT_MODES, FINOPS_SUB_MODES } = require('../../constants/chatModes');

const upsertPersonaSchema = z.object({
  mode: z.enum(Object.values(CHAT_MODES)),
  subMode: z.enum(Object.values(FINOPS_SUB_MODES)).optional(),
  systemPrompt: z.string().min(1).max(10000),
  allowedBinaries: z.array(z.string().min(1)).min(1),
  mutatingCommandCap: z.number().int().min(1).max(1000).optional(),
  docLookupAllowed: z.boolean().optional(),
});

module.exports = { upsertPersonaSchema };
