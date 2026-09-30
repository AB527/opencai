const service = require('./chat.service');

async function create(req, res, next) {
  try {
    res.status(201).json(await service.createSession(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const { search, workspaceId, mode } = req.query;
    const hasMessages = req.query.hasMessages === 'true';
    res.json(
      await service.listSessions(req.user.id, {
        search,
        workspaceId,
        mode,
        hasMessages,
        page,
        pageSize,
      }),
    );
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    res.json(await service.getSession(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    res.status(201).json(await service.sendMessage(req.user.id, req.params.id, req.body.text));
  } catch (err) {
    next(err);
  }
}

async function rename(req, res, next) {
  try {
    res.json(await service.renameSession(req.user.id, req.params.id, req.body.title));
  } catch (err) {
    next(err);
  }
}

async function confirmMessage(req, res, next) {
  try {
    res.json(await service.confirmPendingCommand(req.user.id, req.params.id, req.params.messageId));
  } catch (err) {
    next(err);
  }
}

async function cancelMessage(req, res, next) {
  try {
    res.json(await service.cancelPendingCommand(req.user.id, req.params.id, req.params.messageId));
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getOne, rename, sendMessage, confirmMessage, cancelMessage };
