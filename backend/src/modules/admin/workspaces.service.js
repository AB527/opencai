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
  isActive: true,
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

async function updateWorkspace(workspaceId, { account, environment, isActive }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { account, environment, isActive },
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

// Only an unused Workspace can be deleted: chat sessions require their
// Workspace, and an Operator's history must not disappear with it. Its
// credential is removed by the cascade; audit logs keep their rows.
async function deleteWorkspace(organisationId, workspaceId) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || workspace.organisationId !== organisationId) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND);
  }

  const chatCount = await prisma.chatSession.count({ where: { workspaceId } });
  if (chatCount > 0) {
    throw new AppError(
      409,
      ERROR_CODES.WORKSPACE_HAS_CHATS,
      `This Workspace has ${chatCount} chat session${chatCount === 1 ? '' : 's'} and cannot be deleted.`,
    );
  }

  await prisma.workspace.delete({ where: { id: workspaceId } });
}

module.exports = { createWorkspace, updateWorkspace, setWorkspaceCredential, deleteWorkspace };
