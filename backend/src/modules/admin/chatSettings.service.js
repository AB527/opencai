const prisma = require('../../config/db');

async function getChatSettings() {
  return prisma.chatSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
}

async function updateChatSettings(data) {
  const existing = await prisma.chatSettings.findFirst();
  if (existing) {
    return prisma.chatSettings.update({ where: { id: existing.id }, data });
  }
  return prisma.chatSettings.create({ data });
}

module.exports = { getChatSettings, updateChatSettings };
