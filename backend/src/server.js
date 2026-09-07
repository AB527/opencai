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
