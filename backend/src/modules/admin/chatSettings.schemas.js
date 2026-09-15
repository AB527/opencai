const { z } = require('zod');
const { AI_PROVIDERS } = require('../../constants/aiProviders');

const updateChatSettingsSchema = z.object({
  provider: z.enum(Object.values(AI_PROVIDERS)),
  model: z.string().min(1).max(200),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(), // write-only; omit to leave the stored key unchanged
  config: z.record(z.string(), z.unknown()).optional(),
  maxMutatingCommandsPerSessionDefault: z.number().int().min(1).max(1000).optional(),
  sandboxCommandTimeoutSeconds: z.number().int().min(5).max(600).optional(),
  sandboxIdleTimeoutMinutes: z.number().int().min(1).max(240).optional(),
  spendCeilingUsd: z.number().nonnegative().optional(), // stored, NOT enforced yet (see PLAN.md)
});

module.exports = { updateChatSettingsSchema };
