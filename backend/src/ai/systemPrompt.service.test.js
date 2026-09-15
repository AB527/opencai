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

const db = require('../config/db');
const { AGENT_PREAMBLE } = require('./prompts/preamble');
const { DEFAULT_PERSONAS } = require('./prompts/defaults');
const { getPersona } = require('./systemPrompt.service');

const originalFindUnique = db.agentPersona.findUnique;

function mockFindUnique(impl) {
  db.agentPersona.findUnique = impl;
}

function restoreFindUnique() {
  db.agentPersona.findUnique = originalFindUnique;
}

test('DB row found: systemPrompt is preamble + row text, other fields pass through unchanged', async () => {
  const row = {
    modeKey: 'AIOPS',
    systemPrompt: 'Custom admin-edited persona text.',
    allowedBinaries: ['aws', 'kubectl'],
    mutatingCommandCap: 3,
    docLookupAllowed: false,
  };
  mockFindUnique(async () => row);

  try {
    const result = await getPersona('AIOPS', null);

    assert.ok(result.systemPrompt.startsWith(AGENT_PREAMBLE));
    assert.equal(result.systemPrompt, `${AGENT_PREAMBLE}\n\n${row.systemPrompt}`);
    assert.deepEqual(result.allowedBinaries, row.allowedBinaries);
    assert.equal(result.mutatingCommandCap, row.mutatingCommandCap);
    assert.equal(result.docLookupAllowed, row.docLookupAllowed);
  } finally {
    restoreFindUnique();
  }
});

test('no DB row: falls back to DEFAULT_PERSONAS, mutatingCommandCap null, docLookupAllowed true, and warns', async () => {
  mockFindUnique(async () => null);

  const originalWarn = console.warn;
  let warnCalls = [];
  console.warn = (...args) => {
    warnCalls.push(args);
  };

  try {
    const result = await getPersona('FINOPS', 'COST_ANALYTICS');
    const fallback = DEFAULT_PERSONAS.find((p) => p.modeKey === 'FINOPS_COST_ANALYTICS');

    assert.equal(result.systemPrompt, `${AGENT_PREAMBLE}\n\n${fallback.systemPrompt}`);
    assert.deepEqual(result.allowedBinaries, fallback.allowedBinaries);
    assert.equal(result.mutatingCommandCap, null);
    assert.equal(result.docLookupAllowed, true);
    assert.equal(warnCalls.length, 1);
    assert.match(warnCalls[0][0], /No AgentPersona row for modeKey "FINOPS_COST_ANALYTICS"/);
  } finally {
    console.warn = originalWarn;
    restoreFindUnique();
  }
});

test('modeKey computation: AIOPS with null subMode and with undefined subMode both resolve to "AIOPS"', async () => {
  let capturedWhere;
  mockFindUnique(async (args) => {
    capturedWhere = args.where;
    return null;
  });

  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await getPersona('AIOPS', null);
    assert.deepEqual(capturedWhere, { modeKey: 'AIOPS' });

    await getPersona('AIOPS', undefined);
    assert.deepEqual(capturedWhere, { modeKey: 'AIOPS' });
  } finally {
    console.warn = originalWarn;
    restoreFindUnique();
  }
});

test('FinOps sub-mode: getPersona("FINOPS", "COST_ANALYTICS") looks up modeKey "FINOPS_COST_ANALYTICS"', async () => {
  const row = {
    modeKey: 'FINOPS_COST_ANALYTICS',
    systemPrompt: 'Cost analytics persona text.',
    allowedBinaries: ['aws'],
    mutatingCommandCap: 0,
    docLookupAllowed: true,
  };
  let capturedWhere;
  mockFindUnique(async (args) => {
    capturedWhere = args.where;
    return row;
  });

  try {
    const result = await getPersona('FINOPS', 'COST_ANALYTICS');
    assert.deepEqual(capturedWhere, { modeKey: 'FINOPS_COST_ANALYTICS' });
    assert.equal(result.systemPrompt, `${AGENT_PREAMBLE}\n\n${row.systemPrompt}`);
  } finally {
    restoreFindUnique();
  }
});

test('unreachable modeKey: neither a DB row nor a DEFAULT_PERSONAS entry throws', async () => {
  mockFindUnique(async () => null);

  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await assert.rejects(
      () => getPersona('AIOPS', 'NOT_A_REAL_SUBMODE'),
      /No persona or default found for modeKey "AIOPS_NOT_A_REAL_SUBMODE"/,
    );
  } finally {
    console.warn = originalWarn;
    restoreFindUnique();
  }
});
