require('dotenv/config');
const { defineConfig } = require('prisma/config');

// Prisma 7's CLI reads the connection string from here, not from schema.prisma's
// datasource block -- keep this in sync with backend/.env's DATABASE_URL.
module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
