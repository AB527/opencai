const prisma = require('../../config/db');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

async function listChatSessions({ userId, workspaceId, page, pageSize }) {
  const where = {};
  if (userId) where.userId = userId;
  if (workspaceId) where.workspaceId = workspaceId;

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      select: {
        id: true,
        mode: true,
        subMode: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true } },
        workspace: { select: { id: true, account: true, environment: true, csp: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return { sessions, total, page, pageSize };
}

async function getChatSessionMessages(sessionId) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

module.exports = { listChatSessions, getChatSessionMessages };
