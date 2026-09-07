const express = require('express');
const { healthz, readyz } = require('./open.controller');

const router = express.Router();

router.get('/healthz', healthz);
router.get('/readyz', readyz);

module.exports = router;
