const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

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

  return prisma.chatSession.create({
    data: { userId, workspaceId, mode, subMode },
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

module.exports = { createSession, listSessions, getSession };
