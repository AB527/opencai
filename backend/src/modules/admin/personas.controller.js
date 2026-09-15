const service = require('./personas.service');

async function list(req, res, next) {
  try {
    res.json(await service.listPersonas());
  } catch (err) {
    next(err);
  }
}

async function upsert(req, res, next) {
  try {
    res.json(await service.upsertPersona(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, upsert };
