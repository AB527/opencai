const prisma = require('../../config/db');
const envelope = require('../../crypto/envelope');

function toPublicShape(row) {
  if (!row) return null;
  const { providerApiKeyEncrypted, ...rest } = row;
  return { ...rest, hasApiKey: Boolean(providerApiKeyEncrypted) };
}

async function getChatSettings() {
  const row = await prisma.chatSettings.findFirst({ orderBy: { updatedAt: 'desc' } });
  return toPublicShape(row);
}

async function updateChatSettings(data) {
  const { apiKey, ...rest } = data;
  const updateData = { ...rest };
  if (apiKey) {
    updateData.providerApiKeyEncrypted = envelope.encrypt(apiKey);
  }

  const existing = await prisma.chatSettings.findFirst();
  const row = existing
    ? await prisma.chatSettings.update({ where: { id: existing.id }, data: updateData })
    : await prisma.chatSettings.create({ data: updateData });

  return toPublicShape(row);
}

module.exports = { getChatSettings, updateChatSettings };
