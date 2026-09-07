const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const openRoute = require('./modules/open/open.route');
const authRoute = require('./modules/auth/auth.route');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.nodeEnv === 'production' ? false : true }));
app.use(express.json());

// Infra-probe endpoints (/healthz, /readyz) are mounted unprefixed at root.
// Application routes mount under /api/* starting in Phase 2.
app.use(openRoute);
app.use('/api/auth', authRoute);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

module.exports = app;
