const { z } = require('zod');

const createOperatorSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  organisationIds: z.array(z.string()).optional().default([]),
});

const updateOperatorSchema = z.object({
  organisationIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createOperatorSchema, updateOperatorSchema };
