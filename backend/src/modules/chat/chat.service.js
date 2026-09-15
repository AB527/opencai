const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');
const envelope = require('../../crypto/envelope');
const orchestrator = require('../../ai/orchestrator');
const { getPersona } = require('../../ai/systemPrompt.service');
const { CHAT_MESSAGE_STATUS } = require('../../constants/chatMessageStatus');

const SESSION_SELECT = {
  id: true,
  mode: true,
  subMode: true,
  createdAt: true,
  updatedAt: true,
  workspace: {
    select: {
      id: true,
      csp: true,
      account: true,
      environment: true,
      organisation: { select: { id: true, name: true } },
    },
  },
};

// Sessions/messages are scoped to the AI agent execution flow (Phase 6) --
// this module only covers the CRUD a Phase 5 chat UI needs to have real
// sessions to create, list, and revisit.

async function createSession(userId, { workspaceId, mode, subMode }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  const access = await prisma.userOrganisation.findUnique({
    where: { userId_organisationId: { userId, organisationId: workspace.organisationId } },
  });
  if (!access) throw new AppError(403, ERROR_CODES.FORBIDDEN);

  const [persona, settings] = await Promise.all([
    getPersona(mode, subMode),
    prisma.chatSettings.findFirst(),
  ]);
  const mutatingCommandCap =
    persona.mutatingCommandCap ?? settings?.maxMutatingCommandsPerSessionDefault ?? 10;

  return prisma.chatSession.create({
    data: { userId, workspaceId, mode, subMode, mutatingCommandCap },
    select: SESSION_SELECT,
  });
}

async function listSessions(userId, { search, workspaceId, mode, page, pageSize }) {
  const where = { userId };
  if (workspaceId) where.workspaceId = workspaceId;
  if (mode) where.mode = mode;
  if (search) {
    where.OR = [
      { workspace: { account: { contains: search, mode: 'insensitive' } } },
      { workspace: { environment: { contains: search, mode: 'insensitive' } } },
      { workspace: { organisation: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      select: SESSION_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return { sessions, total, page, pageSize };
}

async function getSession(userId, sessionId) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { ...SESSION_SELECT, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return session;
}

// Resolves session + workspace + decrypted credential in one place for
// sendMessage/confirmPendingCommand. Deliberately fetches the FULL ChatSession
// row (no select) -- the orchestrator needs every column, not the narrowed
// SESSION_SELECT projection the list/get endpoints use for display purposes.
async function loadSessionWithCredential(userId, sessionId) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: { workspace: { include: { credential: true } } },
  });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  if (!session.workspace.credential) {
    throw new AppError(422, ERROR_CODES.WORKSPACE_CREDENTIAL_MISSING);
  }

  const credential = JSON.parse(envelope.decrypt(session.workspace.credential.encryptedCredentials));
  return { session, workspace: session.workspace, credential };
}

async function sendMessage(userId, sessionId, text) {
  const { session, workspace, credential } = await loadSessionWithCredential(userId, sessionId);

  const existingPending = await prisma.chatMessage.findFirst({
    where: { sessionId, status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION },
  });
  if (existingPending) {
    throw new AppError(409, ERROR_CODES.PENDING_COMMAND_EXISTS);
  }

  return orchestrator.handleUserMessage({ session, workspace, credential, userId, text });
}

async function confirmPendingCommand(userId, sessionId, messageId) {
  const { session, workspace, credential } = await loadSessionWithCredential(userId, sessionId);
  return orchestrator.confirmCommand({ session, workspace, credential, messageId, userId });
}

async function cancelPendingCommand(userId, sessionId, messageId) {
  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return orchestrator.cancelCommand({ session, messageId, userId });
}

module.exports = {
  createSession,
  listSessions,
  getSession,
  sendMessage,
  confirmPendingCommand,
  cancelPendingCommand,
};
