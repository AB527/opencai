let config;
try {
  config = require('./config/env');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require('./app');

app.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port}`);
});

// Reap idle sandbox containers. Lives here, not in app.js: app.js is the pure
// Express app definition and may be required by tests that must not start a
// live sweep timer against a real (or absent) Docker daemon.
const { startIdleSweep } = require('./ai/sandbox/sandboxManager');
startIdleSweep();
