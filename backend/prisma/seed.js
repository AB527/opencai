require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { ROLES } = require('../src/constants/roles');
const { MASTER_ADMIN_USERNAME } = require('../src/constants/admin');

const BCRYPT_COST = 12;

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({ where: { username: MASTER_ADMIN_USERNAME } });
  if (existing) {
    console.log(`Master admin "${MASTER_ADMIN_USERNAME}" already exists, skipping.`);
    await prisma.$disconnect();
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await prisma.user.create({
    data: {
      username: MASTER_ADMIN_USERNAME,
      passwordHash,
      role: ROLES.ADMIN,
    },
  });

  console.log(`Created master admin "${MASTER_ADMIN_USERNAME}".`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(`Generated password (save this now, it will not be shown again): ${password}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
