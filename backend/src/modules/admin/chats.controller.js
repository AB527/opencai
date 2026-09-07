const service = require('./chats.service');

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const { userId, workspaceId } = req.query;
    res.json(await service.listChatSessions({ userId, workspaceId, page, pageSize }));
  } catch (err) {
    next(err);
  }
}

async function messages(req, res, next) {
  try {
    res.json(await service.getChatSessionMessages(req.params.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, messages };
