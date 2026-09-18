require('dotenv').config();

const NODE_ENVS = ['development', 'test', 'production'];

function readRequired(errors, key, { validate } = {}) {
  const value = process.env[key];
  if (!value) {
    errors.push(`${key} is required (see backend/.env.example)`);
    return undefined;
  }
  if (validate && !validate(value)) {
    errors.push(`${key} is set but invalid (see backend/.env.example)`);
    return undefined;
  }
  return value;
}

function loadConfig() {
  const errors = [];

  const databaseUrl = readRequired(errors, 'DATABASE_URL', {
    validate: (v) => /^postgres(ql)?:\/\//.test(v),
  });
  const jwtSecret = readRequired(errors, 'JWT_SECRET');
  const masterEncryptionKey = readRequired(errors, 'MASTER_ENCRYPTION_KEY');
  const totpIssuerName = readRequired(errors, 'TOTP_ISSUER_NAME');
  const s3Endpoint = readRequired(errors, 'S3_ENDPOINT');
  const s3AccessKey = readRequired(errors, 'S3_ACCESS_KEY');
  const s3SecretKey = readRequired(errors, 'S3_SECRET_KEY');
  const s3Bucket = readRequired(errors, 'S3_BUCKET');

  // Optional: the browser-facing URL for S3/MinIO, when it differs from the
  // internal endpoint the backend itself uses (e.g. `S3_ENDPOINT` is a
  // compose-network-only hostname like `http://minio:9000` that a browser on
  // the host can't resolve). Defaults to `s3Endpoint` when unset, so local
  // dev / `dev.sh` (where `S3_ENDPOINT` is already browser-reachable) is
  // unaffected.
  const s3PublicUrl = process.env.S3_PUBLIC_URL || s3Endpoint;

  // Optional: an explicit CORS origin for when the frontend is served from a
  // different origin than the backend (e.g. the containerized run, where
  // nginx serves the frontend on :8080 and the backend listens on :4000).
  // When unset, falls back to the existing NODE_ENV-based behavior.
  const corsOrigin = process.env.CORS_ORIGIN || undefined;

  const rawPort = process.env.PORT || '4000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    errors.push(`PORT must be a positive integer, got "${rawPort}"`);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!NODE_ENVS.includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}, got "${nodeEnv}"`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return Object.freeze({
    port,
    nodeEnv,
    databaseUrl,
    jwtSecret,
    masterEncryptionKey,
    totpIssuerName,
    s3Endpoint,
    s3AccessKey,
    s3SecretKey,
    s3Bucket,
    s3PublicUrl,
    corsOrigin,
  });
}

module.exports = loadConfig();
