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
    res.json(await service.listSessions(req.user.id, { search, workspaceId, mode, page, pageSize }));
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

module.exports = { create, list, getOne };
