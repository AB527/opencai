const { z } = require('zod');

const createAdministratorSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

module.exports = { createAdministratorSchema };
