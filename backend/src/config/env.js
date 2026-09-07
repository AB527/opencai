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
  });
}

module.exports = loadConfig();
