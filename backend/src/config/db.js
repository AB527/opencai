const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const config = require('./env');

// Cache the client on `global` outside production so nodemon reloads don't
// spin up a new connection pool on every restart.
const adapter = new PrismaPg({ connectionString: config.databaseUrl });

const prisma =
  config.nodeEnv === 'production'
    ? new PrismaClient({ adapter })
    : (global.__prisma ??= new PrismaClient({ adapter }));

module.exports = prisma;
