const express = require('express');
const { healthz, readyz, branding } = require('./open.controller');

const router = express.Router();

router.get('/healthz', healthz);
router.get('/readyz', readyz);
router.get('/branding', branding);

module.exports = router;
