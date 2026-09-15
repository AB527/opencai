const { test } = require('node:test');
const assert = require('node:assert/strict');

const { credentialToEnv } = require('./credentials');
const { CSP } = require('../constants/csp');

test('maps an AWS credential payload onto AWS CLI env vars', () => {
  const env = credentialToEnv(CSP.AWS, {
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret-value',
  });

  assert.deepEqual(env, {
    AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
    AWS_SECRET_ACCESS_KEY: 'secret-value',
  });
});

test('ignores unknown fields in the AWS credential payload', () => {
  const env = credentialToEnv(CSP.AWS, {
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret-value',
    sessionToken: 'not-in-the-data-model',
  });

  assert.deepEqual(Object.keys(env).sort(), ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']);
});

test('does not set AWS_DEFAULT_REGION (no region exists in the data model)', () => {
  const env = credentialToEnv(CSP.AWS, {
    accessKeyId: 'AKIAEXAMPLE',
    secretAccessKey: 'secret-value',
  });

  assert.equal(env.AWS_DEFAULT_REGION, undefined);
});

test('throws for an unsupported CSP', () => {
  assert.throws(() => credentialToEnv('GCP', { accessKeyId: 'a', secretAccessKey: 'b' }), {
    message: 'Unsupported CSP: GCP',
  });
});

test('throws for an undefined CSP', () => {
  assert.throws(() => credentialToEnv(undefined, {}), /Unsupported CSP/);
});

test('is case-sensitive about the CSP value', () => {
  assert.throws(() => credentialToEnv('aws', { accessKeyId: 'a', secretAccessKey: 'b' }), {
    message: 'Unsupported CSP: aws',
  });
});

test('throws when the AWS credential payload is missing', () => {
  assert.throws(() => credentialToEnv(CSP.AWS, null), /Missing credential payload/);
});

test('throws when the AWS credential payload is incomplete', () => {
  assert.throws(() => credentialToEnv(CSP.AWS, { accessKeyId: 'AKIAEXAMPLE' }), {
    message: 'Incomplete AWS credential payload',
  });
  assert.throws(() => credentialToEnv(CSP.AWS, { secretAccessKey: 'secret' }), {
    message: 'Incomplete AWS credential payload',
  });
});
