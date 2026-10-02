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

const prisma = require('../../config/db');
const sandboxManager = require('../../ai/sandbox/sandboxManager');
const service = require('./chats.service');

/* -------------------------------------------------------------------------- */
/* Mock helpers -- direct require() + reassignment, restored in `finally`,    */
/* same style as personas.service.test.js.                                    */
/* -------------------------------------------------------------------------- */

const originals = {
  chatSessionFindUnique: prisma.chatSession.findUnique,
  chatSessionDelete: prisma.chatSession.delete,
  destroySandbox: sandboxManager.destroySandbox,
};

function restoreAll() {
  prisma.chatSession.findUnique = originals.chatSessionFindUnique;
  prisma.chatSession.delete = originals.chatSessionDelete;
  sandboxManager.destroySandbox = originals.destroySandbox;
}

const SESSION_ID = 'sess-1';

function mockSession(session, { destroyThrows = false } = {}) {
  const calls = { deleted: [], destroyed: [] };
  prisma.chatSession.findUnique = async () => session;
  prisma.chatSession.delete = async (args) => {
    calls.deleted.push(args.where.id);
  };
  sandboxManager.destroySandbox = async (s) => {
    calls.destroyed.push(s.id);
    if (destroyThrows) throw new Error('docker unreachable');
  };
  return calls;
}

test('deleteChatSession: deletes a chat with no sandbox, without touching Docker', async () => {
  const calls = mockSession({ id: SESSION_ID, sandboxContainerId: null, sandboxStatus: null });
  try {
    await service.deleteChatSession(SESSION_ID);
    assert.deepEqual(calls.deleted, [SESSION_ID]);
    assert.deepEqual(calls.destroyed, []);
  } finally {
    restoreAll();
  }
});

test('deleteChatSession: stops a running sandbox before deleting', async () => {
  const calls = mockSession({ id: SESSION_ID, sandboxContainerId: 'c-1', sandboxStatus: 'ready' });
  try {
    await service.deleteChatSession(SESSION_ID);
    assert.deepEqual(calls.destroyed, [SESSION_ID]);
    assert.deepEqual(calls.deleted, [SESSION_ID]);
  } finally {
    restoreAll();
  }
});

test('deleteChatSession: still deletes when the sandbox cannot be stopped', async () => {
  const calls = mockSession(
    { id: SESSION_ID, sandboxContainerId: 'c-1', sandboxStatus: 'ready' },
    { destroyThrows: true },
  );
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await service.deleteChatSession(SESSION_ID);
    assert.deepEqual(calls.deleted, [SESSION_ID]);
  } finally {
    console.warn = originalWarn;
    restoreAll();
  }
});

test('deleteChatSession: 404 for a missing chat', async () => {
  const calls = mockSession(null);
  try {
    await assert.rejects(service.deleteChatSession(SESSION_ID), { status: 404 });
    assert.deepEqual(calls.deleted, []);
  } finally {
    restoreAll();
  }
});
