const { z } = require('zod');

const updateChatSettingsSchema = z.object({
  provider: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  config: z.record(z.string(), z.unknown()).optional(),
});

module.exports = { updateChatSettingsSchema };
