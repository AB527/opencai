const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/db';
process.env.JWT_SECRET ||= 'test-jwt-secret';
process.env.MASTER_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');
process.env.TOTP_ISSUER_NAME ||= 'OpenCAI Test';
process.env.S3_ENDPOINT ||= 'http://localhost:9000';
process.env.S3_ACCESS_KEY ||= 'test';
process.env.S3_SECRET_KEY ||= 'test';
process.env.S3_BUCKET ||= 'test';

const { encrypt, decrypt } = require('./envelope');

test('round-trips a plaintext string', () => {
  const plaintext = 'super-secret-value';
  const encrypted = encrypt(plaintext);
  assert.equal(decrypt(encrypted), plaintext);
});

test('produces different ciphertext for the same plaintext each time', () => {
  const plaintext = 'same-input';
  const a = encrypt(plaintext);
  const b = encrypt(plaintext);
  assert.notEqual(a, b);
  assert.equal(decrypt(a), plaintext);
  assert.equal(decrypt(b), plaintext);
});

test('rejects a tampered ciphertext', () => {
  const encrypted = encrypt('do-not-tamper');
  const envelope = JSON.parse(encrypted);
  envelope.ciphertext = Buffer.from('tampered-bytes-here').toString('base64');
  assert.throws(() => decrypt(JSON.stringify(envelope)));
});

test('rejects an envelope decrypted with the wrong master key', () => {
  const encrypted = encrypt('protect-me');

  const originalKey = process.env.MASTER_ENCRYPTION_KEY;
  process.env.MASTER_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('./envelope')];
  const { decrypt: decryptWithWrongKey } = require('./envelope');

  assert.throws(() => decryptWithWrongKey(encrypted));

  process.env.MASTER_ENCRYPTION_KEY = originalKey;
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('./envelope')];
});
