const service = require('./administrators.service');

async function list(req, res, next) {
  try {
    res.json(await service.listAdministrators());
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, password } = req.body;
    res.status(201).json(await service.createAdministrator(username, password));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await service.deleteAdministrator(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, remove };
