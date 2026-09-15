const Docker = require('dockerode');

// No options: dockerode auto-detects the platform default socket
// (/var/run/docker.sock on Linux/macOS, the //./pipe/docker_engine named pipe
// on Windows via Docker Desktop), and honours DOCKER_HOST when set.
const docker = new Docker();

module.exports = { docker };
