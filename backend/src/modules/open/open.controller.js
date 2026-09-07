const { checkDatabaseConnection, getInstanceBranding } = require('./open.service');

function healthz(req, res) {
  res.status(200).json({ status: 'ok' });
}

async function readyz(req, res) {
  const result = await checkDatabaseConnection();
  if (result.ok) {
    res.status(200).json({ status: 'ok', db: 'reachable' });
  } else {
    res.status(503).json({ status: 'error', db: 'unreachable', message: result.error });
  }
}

async function branding(req, res, next) {
  try {
    res.json(await getInstanceBranding());
  } catch (err) {
    next(err);
  }
}

module.exports = { healthz, readyz, branding };
