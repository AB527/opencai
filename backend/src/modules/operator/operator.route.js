const express = require('express');
const controller = require('./operator.controller');

const router = express.Router();

router.get('/organisations', controller.listOrganisations);
router.get('/organisations/:orgId/workspaces', controller.listWorkspaces);

module.exports = router;
