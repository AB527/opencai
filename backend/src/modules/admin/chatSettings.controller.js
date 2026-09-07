const service = require('./chatSettings.service');

async function get(req, res, next) {
  try {
    res.json(await service.getChatSettings());
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    res.json(await service.updateChatSettings(req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update };
