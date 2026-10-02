const orgService = require('./organisations.service');
const workspaceService = require('./workspaces.service');

async function list(req, res, next) {
  try {
    res.json(await orgService.listOrganisations());
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    res.status(201).json(await orgService.createOrganisation(req.body));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    res.json(await orgService.getOrganisation(req.params.id));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    res.json(await orgService.updateOrganisation(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function createWorkspace(req, res, next) {
  try {
    res.status(201).json(await workspaceService.createWorkspace(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function updateWorkspace(req, res, next) {
  try {
    res.json(await workspaceService.updateWorkspace(req.params.workspaceId, req.body));
  } catch (err) {
    next(err);
  }
}

async function setWorkspaceCredential(req, res, next) {
  try {
    await workspaceService.setWorkspaceCredential(req.params.workspaceId, req.body);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function deleteWorkspace(req, res, next) {
  try {
    await workspaceService.deleteWorkspace(req.params.id, req.params.workspaceId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  getOne,
  update,
  createWorkspace,
  updateWorkspace,
  setWorkspaceCredential,
  deleteWorkspace,
};
