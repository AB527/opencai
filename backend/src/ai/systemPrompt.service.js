const prisma = require('../config/db');
const { AGENT_PREAMBLE } = require('./prompts/preamble');
const { DEFAULT_PERSONAS } = require('./prompts/defaults');

async function getPersona(mode, subMode) {
  const modeKey = subMode ? `${mode}_${subMode}` : mode;

  const row = await prisma.agentPersona.findUnique({ where: { modeKey } });

  if (row) {
    return {
      systemPrompt: `${AGENT_PREAMBLE}\n\n${row.systemPrompt}`,
      allowedBinaries: row.allowedBinaries,
      mutatingCommandCap: row.mutatingCommandCap,
      docLookupAllowed: row.docLookupAllowed,
    };
  }

  console.warn(`No AgentPersona row for modeKey "${modeKey}", falling back to DEFAULT_PERSONAS`);

  const fallback = DEFAULT_PERSONAS.find((persona) => persona.modeKey === modeKey);
  if (!fallback) {
    throw new Error(`No persona or default found for modeKey "${modeKey}"`);
  }

  return {
    systemPrompt: `${AGENT_PREAMBLE}\n\n${fallback.systemPrompt}`,
    allowedBinaries: fallback.allowedBinaries,
    mutatingCommandCap: null,
    docLookupAllowed: true,
  };
}

module.exports = { getPersona };
