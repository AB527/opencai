const prisma = require('../../config/db');
const sandboxManager = require('../../ai/sandbox/sandboxManager');
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
        title: true,
        mode: true,
        subMode: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, username: true } },
        workspace: {
          select: {
            id: true,
            account: true,
            environment: true,
            csp: true,
            organisation: { select: { name: true } },
          },
        },
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

// Deletes a chat and its messages (cascade); audit logs keep their rows with
// the session link cleared. A still-running sandbox is stopped first so its
// container isn't orphaned -- but an unreachable Docker never blocks the delete.
async function deleteChatSession(sessionId) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(404, ERROR_CODES.NOT_FOUND);

  if (session.sandboxContainerId && session.sandboxStatus === 'ready') {
    try {
      await sandboxManager.destroySandbox(session);
    } catch (err) {
      console.warn(`[chats] could not stop sandbox for session ${sessionId}: ${err.message}`);
    }
  }

  await prisma.chatSession.delete({ where: { id: sessionId } });
}

module.exports = { listChatSessions, getChatSessionMessages, deleteChatSession };
