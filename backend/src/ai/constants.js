// Limits on model turns and wall-clock orchestration time
const MAX_MODEL_TURNS_PER_MESSAGE = 8;
const MAX_ORCHESTRATION_WALL_CLOCK_MS = 120000;

// Sandbox runtime configuration
// A deliberately LOCAL tag, built from backend/sandbox/Dockerfile (see that
// directory's README). It must not be an upstream-resolvable reference: if the
// image hasn't been built, createContainer must fail loudly with "no such
// image" rather than silently pulling the unhardened upstream aws-cli image and
// running the sandbox as root.
const SANDBOX_IMAGE_TAG = 'opencai-sandbox:2.15.30';
const SANDBOX_DEFAULT_MEMORY_BYTES = 536870912; // 512 MB
const SANDBOX_DEFAULT_NANO_CPUS = 1000000000; // 1 vCPU
const SANDBOX_DEFAULT_PIDS_LIMIT = 64;

module.exports = {
  MAX_MODEL_TURNS_PER_MESSAGE,
  MAX_ORCHESTRATION_WALL_CLOCK_MS,
  SANDBOX_IMAGE_TAG,
  SANDBOX_DEFAULT_MEMORY_BYTES,
  SANDBOX_DEFAULT_NANO_CPUS,
  SANDBOX_DEFAULT_PIDS_LIMIT,
};
