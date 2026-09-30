const { test } = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeOutput } = require('./sanitizer');

test('redacts a long-lived AWS access key ID', () => {
  const out = sanitizeOutput('key is AKIAIOSFODNN7EXAMPLE here');
  assert.equal(out, 'key is [REDACTED] here');
});

test('redacts a temporary ASIA access key ID', () => {
  const out = sanitizeOutput('ASIAIOSFODNN7EXAMPLE');
  assert.equal(out, '[REDACTED]');
});

test('redacts every access key ID in the output, not just the first', () => {
  const out = sanitizeOutput('AKIAIOSFODNN7EXAMPLE and ASIAJKLMNOPQRSTUVWXY');
  assert.equal(out, '[REDACTED] and [REDACTED]');
});

test('redacts a PEM private key block', () => {
  const input = [
    'preamble',
    '-----BEGIN RSA PRIVATE KEY-----',
    'MIIEowIBAAKCAQEAxYZ1234567890abcdefgh',
    'ijklmnopqrstuvwxyz0987654321ABCDEF',
    '-----END RSA PRIVATE KEY-----',
    'trailer',
  ].join('\n');
  const out = sanitizeOutput(input);
  assert.equal(out, 'preamble\n[REDACTED PRIVATE KEY]\ntrailer');
  assert.ok(!out.includes('MIIEowIBAAKCAQEA'));
});

test('redacts unlabelled, EC and OPENSSH PEM private key blocks', () => {
  for (const label of ['', 'EC ', 'OPENSSH ']) {
    const input = `-----BEGIN ${label}PRIVATE KEY-----\nbody\n-----END ${label}PRIVATE KEY-----`;
    assert.equal(sanitizeOutput(input), '[REDACTED PRIVATE KEY]');
  }
});

test('redacts two PEM blocks in the same output', () => {
  const block = '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----';
  const out = sanitizeOutput(`${block}\n${block}`);
  assert.equal(out, '[REDACTED PRIVATE KEY]\n[REDACTED PRIVATE KEY]');
});

test('redacts JSON-shaped secret fields', () => {
  const input = JSON.stringify({
    AccessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    SecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    SessionToken: 'FQoGZXIvYXdzEJr//////////wEaDA==',
    Expiration: '2026-01-01T00:00:00Z',
  });
  const out = sanitizeOutput(input);
  assert.ok(out.includes('"SecretAccessKey": "[REDACTED]"'));
  assert.ok(out.includes('"SessionToken": "[REDACTED]"'));
  assert.ok(!out.includes('wJalrXUtnFEMI'));
  assert.ok(!out.includes('FQoGZXIvYXdz'));
  assert.ok(out.includes('"Expiration":"2026-01-01T00:00:00Z"'));
});

test('matches JSON secret field names case-insensitively', () => {
  const out = sanitizeOutput('{"secretString": "abc", "password": "hunter2"}');
  assert.equal(out, '{"secretString": "[REDACTED]", "password": "[REDACTED]"}');
});

test('leaves non-secret JSON fields untouched', () => {
  const input = '{"InstanceId": "i-0123456789abcdef0", "State": "running"}';
  assert.equal(sanitizeOutput(input), input);
});

test('redacts ini/env-shaped secret fields', () => {
  const input = [
    '[default]',
    'aws_access_key_id = AKIAIOSFODNN7EXAMPLE',
    'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'aws_session_token=FQoGZXIvYXdzEJr',
    'region = us-east-1',
  ].join('\n');
  const out = sanitizeOutput(input);
  assert.equal(
    out,
    [
      '[default]',
      'aws_access_key_id = [REDACTED]',
      'aws_secret_access_key = [REDACTED]',
      'aws_session_token=[REDACTED]',
      'region = us-east-1',
    ].join('\n'),
  );
});

test('redacts ini/env secret fields case-insensitively and when indented', () => {
  const input = '  PASSWORD=hunter2\n\tprivate_key = abc\nSECRET = xyz';
  const out = sanitizeOutput(input);
  assert.equal(out, '  PASSWORD=[REDACTED]\n\tprivate_key = [REDACTED]\nSECRET = [REDACTED]');
});

test('redacts ini/env secret fields on every line, not just the first', () => {
  const out = sanitizeOutput('password=a\npassword=b\npassword=c');
  assert.equal(out, 'password=[REDACTED]\npassword=[REDACTED]\npassword=[REDACTED]');
});

test('passes ordinary non-secret output through completely unchanged', () => {
  const input = [
    '{',
    '    "Reservations": [',
    '        {',
    '            "Instances": [',
    '                {',
    '                    "InstanceId": "i-0123456789abcdef0",',
    '                    "InstanceType": "t3.micro",',
    '                    "State": { "Name": "running" }',
    '                }',
    '            ]',
    '        }',
    '    ]',
    '}',
  ].join('\n');
  assert.equal(sanitizeOutput(input), input);
});

test('does not leak regex lastIndex state between calls', () => {
  // A stateful module-level /g regex would resume from a previous call's
  // lastIndex and silently miss a secret near the start of the next input.
  const long = `filler filler filler AKIAIOSFODNN7EXAMPLE ${'x'.repeat(200)}`;
  const first = sanitizeOutput(long);
  assert.ok(!first.includes('AKIAIOSFODNN7EXAMPLE'));

  const second = sanitizeOutput('ASIAIOSFODNN7EXAMPLE');
  assert.equal(second, '[REDACTED]');

  const third = sanitizeOutput('password=hunter2');
  assert.equal(third, 'password=[REDACTED]');

  const fourth = sanitizeOutput('{"SecretAccessKey": "abc"}');
  assert.equal(fourth, '{"SecretAccessKey": "[REDACTED]"}');

  // Re-running the very first input must produce the identical result.
  assert.equal(sanitizeOutput(long), first);
});

test('is idempotent: sanitizing already-sanitized output changes nothing', () => {
  const input = 'AKIAIOSFODNN7EXAMPLE\npassword=hunter2\n{"SessionToken": "abc"}';
  const once = sanitizeOutput(input);
  assert.equal(sanitizeOutput(once), once);
});

test('applies all four rules to the same string', () => {
  const input = [
    'AKIAIOSFODNN7EXAMPLE',
    '-----BEGIN PRIVATE KEY-----\nbody\n-----END PRIVATE KEY-----',
    '{"SecretAccessKey": "shh"}',
    'aws_session_token = shh',
  ].join('\n');
  const out = sanitizeOutput(input);
  assert.equal(
    out,
    [
      '[REDACTED]',
      '[REDACTED PRIVATE KEY]',
      '{"SecretAccessKey": "[REDACTED]"}',
      'aws_session_token = [REDACTED]',
    ].join('\n'),
  );
});

test('returns the empty string unchanged', () => {
  assert.equal(sanitizeOutput(''), '');
});

// --- non-string input must fail closed, never pass through -----------------
//
// child_process stdout/stderr are Buffers unless the caller sets an encoding.
// Returning a non-string input unchanged would hand back every secret in it
// intact while looking, at the call site, like a successful sanitize.

test('redacts secrets in a Buffer input instead of returning it unredacted', () => {
  const buf = Buffer.from('key is AKIAIOSFODNN7EXAMPLE here', 'utf8');
  const out = sanitizeOutput(buf);
  assert.equal(typeof out, 'string');
  assert.equal(out, 'key is [REDACTED] here');
  assert.ok(!out.includes('AKIAIOSFODNN7EXAMPLE'));
});

test('applies every rule to Buffer input, not just the access-key rule', () => {
  const input = [
    '-----BEGIN PRIVATE KEY-----',
    'MIIEowIBAAKCAQEAsecretbody',
    '-----END PRIVATE KEY-----',
    '{"SecretAccessKey": "wJalrXUtnFEMI"}',
    'aws_session_token = FQoGZXIvYXdz',
  ].join('\n');
  const out = sanitizeOutput(Buffer.from(input, 'utf8'));
  assert.equal(
    out,
    [
      '[REDACTED PRIVATE KEY]',
      '{"SecretAccessKey": "[REDACTED]"}',
      'aws_session_token = [REDACTED]',
    ].join('\n'),
  );
  assert.ok(!out.includes('MIIEowIBAAKCAQEAsecretbody'));
  assert.ok(!out.includes('wJalrXUtnFEMI'));
  assert.ok(!out.includes('FQoGZXIvYXdz'));
});

test('always returns a string, coercing other non-string inputs', () => {
  assert.equal(sanitizeOutput(null), 'null');
  assert.equal(sanitizeOutput(undefined), 'undefined');
  assert.equal(sanitizeOutput(42), '42');
  for (const value of [null, undefined, 42, {}, [], true]) {
    assert.equal(typeof sanitizeOutput(value), 'string');
  }
});

test('strips terminal escape sequences, including ones splitting a key ID', () => {
  assert.equal(
    sanitizeOutput('\x1b[1mNAME\x1b[0m\n  describe-instances'),
    'NAME\n  describe-instances',
  );
  assert.equal(sanitizeOutput('key AKIA\x1b[1mIOSFODNN7EXAMPLE'), 'key [REDACTED]');
});
