const prisma = require('../../config/db');
const envelope = require('../../crypto/envelope');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

const WORKSPACE_SELECT = {
  id: true,
  organisationId: true,
  csp: true,
  account: true,
  environment: true,
  createdAt: true,
  credential: { select: { id: true, updatedAt: true } },
};

async function createWorkspace(organisationId, { csp, account, environment }) {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!org) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  return prisma.workspace.create({
    data: { organisationId, csp, account, environment },
    select: WORKSPACE_SELECT,
  });
}

async function updateWorkspace(workspaceId, { account, environment }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { account, environment },
    select: WORKSPACE_SELECT,
  });
}

// credentialFields shape is CSP-specific (e.g. { accessKeyId, secretAccessKey }
// for AWS) -- stored as a single envelope-encrypted JSON blob so adding a
// second CSP never requires a schema change here.
async function setWorkspaceCredential(workspaceId, credentialFields) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  const encryptedCredentials = envelope.encrypt(JSON.stringify(credentialFields));

  await prisma.workspaceCredential.upsert({
    where: { workspaceId },
    create: { workspaceId, encryptedCredentials },
    update: { encryptedCredentials },
  });
}

module.exports = { createWorkspace, updateWorkspace, setWorkspaceCredential };
