const service = require('./operators.service');

async function list(req, res, next) {
  try {
    res.json(await service.listOperators());
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password, organisationIds } = req.body;
    res.status(201).json(await service.createOperator(username, password, organisationIds));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    res.json(await service.updateOperator(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    res.json(await service.deactivateOperator(req.params.id));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteOperator(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function resetMfa(req, res, next) {
  try {
    await service.resetOperatorMfa(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, deactivate, remove, resetMfa };
