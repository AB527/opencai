const prisma = require('../../config/db');

async function listAccessibleOrganisations(userId) {
  const userOrgs = await prisma.userOrganisation.findMany({
    where: { userId },
    select: { organisation: { select: { id: true, name: true } } },
    orderBy: { organisation: { name: 'asc' } },
  });
  return userOrgs.map((uo) => uo.organisation);
}

// Never exposes credentials -- just enough to populate the workspace-selection
// dropdowns (Environment / Cloud Provider / Account derive from this list).
async function listOrganisationWorkspaces(userId, organisationId) {
  const access = await prisma.userOrganisation.findUnique({
    where: { userId_organisationId: { userId, organisationId } },
  });
  if (!access) {
    return [];
  }

  return prisma.workspace.findMany({
    where: { organisationId },
    select: { id: true, csp: true, account: true, environment: true },
    orderBy: [{ environment: 'asc' }, { csp: 'asc' }, { account: 'asc' }],
  });
}

module.exports = { listAccessibleOrganisations, listOrganisationWorkspaces };
