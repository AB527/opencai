const service = require('./operator.service');

async function listOrganisations(req, res, next) {
  try {
    res.json(await service.listAccessibleOrganisations(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function listWorkspaces(req, res, next) {
  try {
    res.json(await service.listOrganisationWorkspaces(req.user.id, req.params.orgId));
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrganisations, listWorkspaces };
