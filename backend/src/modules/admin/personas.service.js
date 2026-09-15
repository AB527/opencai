const prisma = require('../../config/db');

function computeModeKey(mode, subMode) {
  return subMode ? `${mode}_${subMode}` : mode;
}

async function listPersonas() {
  return prisma.agentPersona.findMany({ orderBy: { modeKey: 'asc' } });
}

async function upsertPersona(userId, { mode, subMode, systemPrompt, allowedBinaries, mutatingCommandCap, docLookupAllowed }) {
  const modeKey = computeModeKey(mode, subMode);
  const fields = {
    mode,
    subMode: subMode ?? null,
    systemPrompt,
    allowedBinaries,
    mutatingCommandCap: mutatingCommandCap ?? null,
    docLookupAllowed: docLookupAllowed ?? true,
    updatedByUserId: userId,
  };

  return prisma.agentPersona.upsert({
    where: { modeKey },
    update: fields,
    create: { ...fields, modeKey },
  });
}

module.exports = { listPersonas, upsertPersona };
