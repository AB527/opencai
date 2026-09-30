require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { ROLES } = require('../src/constants/roles');
const { MASTER_ADMIN_USERNAME } = require('../src/constants/admin');
const { DEFAULT_PERSONAS } = require('../src/ai/prompts/defaults');

const BCRYPT_COST = 12;

async function seedMasterAdmin(prisma) {
  const existing = await prisma.user.findUnique({ where: { username: MASTER_ADMIN_USERNAME } });
  if (existing) {
    console.log(`Master admin "${MASTER_ADMIN_USERNAME}" already exists, skipping.`);
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD || 'admin';
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
    console.log(`Password: "admin" (default — set SEED_ADMIN_PASSWORD before first seed to choose your own; change this before exposing the instance beyond localhost).`);
  }
}

async function seedAgentPersonas(prisma) {
  for (const persona of DEFAULT_PERSONAS) {
    await prisma.agentPersona.upsert({
      where: { modeKey: persona.modeKey },
      update: {},
      create: persona,
    });
  }
  console.log(`Seeded ${DEFAULT_PERSONAS.length} default agent personas.`);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await seedMasterAdmin(prisma);
  await seedAgentPersonas(prisma);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
