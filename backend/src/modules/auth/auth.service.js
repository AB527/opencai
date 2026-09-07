const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const otplib = require('otplib');
const QRCode = require('qrcode');

const config = require('../../config/env');
const prisma = require('../../config/db');
const envelope = require('../../crypto/envelope');
const { AppError } = require('../../middleware/errorHandler');
const { ERROR_CODES } = require('../../constants/errors');

const SESSION_TOKEN_EXPIRY = '12h';
const MFA_TOKEN_EXPIRY = '10m';
const ENROLLMENT_TOKEN_EXPIRY = '10m';
const BACKUP_CODE_COUNT = 10;
const BCRYPT_COST = 12;

function signToken(payload, expiresIn) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

function verifyToken(token, expectedPurpose, errorCode) {
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (expectedPurpose && payload.purpose !== expectedPurpose) {
      throw new Error('purpose mismatch');
    }
    return payload;
  } catch {
    throw new AppError(401, errorCode || ERROR_CODES.MFA_TOKEN_INVALID);
  }
}

// epochTolerance is in seconds (not steps, despite the name pattern elsewhere
// in otplib) -- 30 allows the previous or next 30-second step, absorbing
// clock drift and the time a person takes to read and type a code.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

async function verifyTotpCode(secret, code) {
  try {
    const result = await otplib.verify({
      secret,
      token: code,
      strategy: 'totp',
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    // otplib throws on malformed input (e.g. a non-6-digit backup code)
    // rather than returning { valid: false } -- treat that as simply invalid.
    return false;
  }
}

function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS);
  }
  if (!user.isActive) {
    throw new AppError(403, ERROR_CODES.ACCOUNT_INACTIVE);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS);
  }

  const mfaEnrolled = Boolean(user.totpSecretEncrypted);
  const mfaToken = signToken({ sub: user.id, purpose: 'mfa-pending' }, MFA_TOKEN_EXPIRY);

  return { mfaToken, mfaEnrolled };
}

async function startEnrollment(mfaToken) {
  const { sub: userId } = verifyToken(mfaToken, 'mfa-pending');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ERROR_CODES.MFA_TOKEN_INVALID);
  }
  if (user.totpSecretEncrypted) {
    throw new AppError(409, ERROR_CODES.MFA_ALREADY_ENROLLED);
  }

  const secret = otplib.generateSecret({ length: 20 });
  const otpauthUri = otplib.generateURI({
    strategy: 'totp',
    issuer: config.totpIssuerName,
    label: user.username,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri);

  const enrollmentToken = signToken(
    { sub: user.id, purpose: 'mfa-enroll', secret },
    ENROLLMENT_TOKEN_EXPIRY,
  );

  return { enrollmentToken, otpauthUri, qrCodeDataUrl };
}

async function confirmEnrollment(enrollmentToken, code) {
  const { sub: userId, secret } = verifyToken(enrollmentToken, 'mfa-enroll');

  if (!(await verifyTotpCode(secret, code))) {
    throw new AppError(401, ERROR_CODES.MFA_CODE_INVALID);
  }

  const backupCodes = generateBackupCodes();
  const backupCodesHashed = await Promise.all(
    backupCodes.map((code_) => bcrypt.hash(code_, BCRYPT_COST)),
  );

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEncrypted: envelope.encrypt(secret),
      backupCodesHashed,
    },
  });

  const token = signToken(
    { sub: user.id, username: user.username, role: user.role },
    SESSION_TOKEN_EXPIRY,
  );

  return { token, backupCodes };
}

async function verifyMfa(mfaToken, code) {
  const { sub: userId } = verifyToken(mfaToken, 'mfa-pending');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpSecretEncrypted) {
    throw new AppError(409, ERROR_CODES.MFA_NOT_ENROLLED);
  }

  const secret = envelope.decrypt(user.totpSecretEncrypted);
  if (await verifyTotpCode(secret, code)) {
    const token = signToken(
      { sub: user.id, username: user.username, role: user.role },
      SESSION_TOKEN_EXPIRY,
    );
    return { token };
  }

  // Fall back to a one-time backup code.
  for (const hashedCode of user.backupCodesHashed) {
    if (await bcrypt.compare(code, hashedCode)) {
      await prisma.user.update({
        where: { id: userId },
        data: { backupCodesHashed: user.backupCodesHashed.filter((c) => c !== hashedCode) },
      });
      const token = signToken(
        { sub: user.id, username: user.username, role: user.role },
        SESSION_TOKEN_EXPIRY,
      );
      return { token };
    }
  }

  throw new AppError(401, ERROR_CODES.MFA_CODE_INVALID);
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ERROR_CODES.UNAUTHENTICATED);
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

module.exports = {
  login,
  startEnrollment,
  confirmEnrollment,
  verifyMfa,
  changePassword,
};
