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
  title: true,
  contextTokens: true,
  contextWindow: true,
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

async function listSessions(userId, { search, workspaceId, mode, hasMessages, page, pageSize }) {
  const where = { userId };
  if (workspaceId) where.workspaceId = workspaceId;
  if (mode) where.mode = mode;
  // Sessions are created as soon as a mode is opened, so most lists want only
  // the ones that were actually used.
  if (hasMessages) where.messages = { some: {} };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
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

  const credential = JSON.parse(
    envelope.decrypt(session.workspace.credential.encryptedCredentials),
  );
  return { session, workspace: session.workspace, credential };
}

const MAX_AUTO_TITLE_LENGTH = 60;

/** A session title from the first message: one line, cut at a word boundary. */
function titleFromMessage(text) {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= MAX_AUTO_TITLE_LENGTH) return oneLine;
  const cut = oneLine.slice(0, MAX_AUTO_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

async function sendMessage(userId, sessionId, text) {
  const { session, workspace, credential } = await loadSessionWithCredential(userId, sessionId);

  const existingPending = await prisma.chatMessage.findFirst({
    where: { sessionId, status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION },
  });
  if (existingPending) {
    throw new AppError(409, ERROR_CODES.PENDING_COMMAND_EXISTS);
  }

  // Only while untitled, so an Operator's rename is never overwritten.
  if (!session.title) {
    await prisma.chatSession.updateMany({
      where: { id: sessionId, title: null },
      data: { title: titleFromMessage(text) },
    });
  }

  return orchestrator.handleUserMessage({ session, workspace, credential, userId, text });
}

async function confirmPendingCommand(userId, sessionId, messageId) {
  const { session, workspace, credential } = await loadSessionWithCredential(userId, sessionId);
  return orchestrator.confirmCommand({ session, workspace, credential, messageId, userId });
}

async function renameSession(userId, sessionId, title) {
  const { count } = await prisma.chatSession.updateMany({
    where: { id: sessionId, userId },
    data: { title },
  });
  if (count !== 1) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return prisma.chatSession.findUnique({ where: { id: sessionId }, select: SESSION_SELECT });
}

async function cancelPendingCommand(userId, sessionId, messageId) {
  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);
  return orchestrator.cancelCommand({ session, messageId, userId });
}

module.exports = {
  titleFromMessage,
  renameSession,
  createSession,
  listSessions,
  getSession,
  sendMessage,
  confirmPendingCommand,
  cancelPendingCommand,
};
