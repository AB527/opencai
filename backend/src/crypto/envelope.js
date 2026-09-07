const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENVELOPE_VERSION = 1;

function getMasterKey() {
  const key = Buffer.from(config.masterEncryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)');
  }
  return key;
}

function encryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

function decryptWithKey(ciphertext, iv, authTag, key) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Envelope-encrypts a plaintext string: a fresh random data key encrypts the
 * plaintext, and that data key is itself encrypted by MASTER_ENCRYPTION_KEY.
 * Returns a single opaque JSON string, safe to store in a text column.
 */
function encrypt(plaintext) {
  const masterKey = getMasterKey();
  const dataKey = crypto.randomBytes(32);

  const data = encryptWithKey(Buffer.from(plaintext, 'utf8'), dataKey);
  const wrappedKey = encryptWithKey(dataKey, masterKey);

  return JSON.stringify({
    v: ENVELOPE_VERSION,
    ciphertext: data.ciphertext.toString('base64'),
    iv: data.iv.toString('base64'),
    authTag: data.authTag.toString('base64'),
    encryptedDataKey: wrappedKey.ciphertext.toString('base64'),
    dataKeyIv: wrappedKey.iv.toString('base64'),
    dataKeyAuthTag: wrappedKey.authTag.toString('base64'),
  });
}

/**
 * Reverses encrypt(): unwraps the data key with the master key, then decrypts
 * the payload with the data key. Throws if the envelope was tampered with or
 * the wrong master key is in use (GCM auth tag verification fails).
 */
function decrypt(serialized) {
  const masterKey = getMasterKey();
  const envelope = JSON.parse(serialized);

  if (envelope.v !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelope version: ${envelope.v}`);
  }

  const dataKey = decryptWithKey(
    Buffer.from(envelope.encryptedDataKey, 'base64'),
    Buffer.from(envelope.dataKeyIv, 'base64'),
    Buffer.from(envelope.dataKeyAuthTag, 'base64'),
    masterKey,
  );

  const plaintext = decryptWithKey(
    Buffer.from(envelope.ciphertext, 'base64'),
    Buffer.from(envelope.iv, 'base64'),
    Buffer.from(envelope.authTag, 'base64'),
    dataKey,
  );

  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
