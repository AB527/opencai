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
const service = require('./workspaces.service');
const { ERROR_CODES } = require('../../constants/errors');

/* -------------------------------------------------------------------------- */
/* Mock helpers -- direct require() + reassignment, restored in `finally`,    */
/* same style as personas.service.test.js.                                    */
/* -------------------------------------------------------------------------- */

const originals = {
  workspaceFindUnique: prisma.workspace.findUnique,
  workspaceUpdate: prisma.workspace.update,
  workspaceDelete: prisma.workspace.delete,
  chatSessionCount: prisma.chatSession.count,
};

function restoreAll() {
  prisma.workspace.findUnique = originals.workspaceFindUnique;
  prisma.workspace.update = originals.workspaceUpdate;
  prisma.workspace.delete = originals.workspaceDelete;
  prisma.chatSession.count = originals.chatSessionCount;
}

const ORG_ID = 'org-1';
const WORKSPACE_ID = 'ws-1';

function mockWorkspace({ organisationId = ORG_ID, chats = 0 } = {}) {
  const deleted = [];
  prisma.workspace.findUnique = async () => ({ id: WORKSPACE_ID, organisationId });
  prisma.chatSession.count = async () => chats;
  prisma.workspace.delete = async (args) => {
    deleted.push(args.where.id);
  };
  return deleted;
}

test('deleteWorkspace: deletes a Workspace with no chat sessions', async () => {
  const deleted = mockWorkspace();
  try {
    await service.deleteWorkspace(ORG_ID, WORKSPACE_ID);
    assert.deepEqual(deleted, [WORKSPACE_ID]);
  } finally {
    restoreAll();
  }
});

test('deleteWorkspace: refuses with 409 while chat sessions exist', async () => {
  const deleted = mockWorkspace({ chats: 3 });
  try {
    await assert.rejects(service.deleteWorkspace(ORG_ID, WORKSPACE_ID), (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, ERROR_CODES.WORKSPACE_HAS_CHATS);
      assert.match(err.message, /3 chat sessions/);
      return true;
    });
    assert.deepEqual(deleted, []);
  } finally {
    restoreAll();
  }
});

test('deleteWorkspace: 404 for a Workspace of another Organisation', async () => {
  const deleted = mockWorkspace({ organisationId: 'org-2' });
  try {
    await assert.rejects(service.deleteWorkspace(ORG_ID, WORKSPACE_ID), { status: 404 });
    assert.deepEqual(deleted, []);
  } finally {
    restoreAll();
  }
});

test('updateWorkspace: passes isActive through, leaving other fields untouched', async () => {
  let capturedData;
  prisma.workspace.findUnique = async () => ({ id: WORKSPACE_ID, organisationId: ORG_ID });
  prisma.workspace.update = async ({ data }) => {
    capturedData = data;
    return { id: WORKSPACE_ID, ...data };
  };
  try {
    await service.updateWorkspace(WORKSPACE_ID, { isActive: false });
    assert.deepEqual(capturedData, {
      account: undefined,
      environment: undefined,
      isActive: false,
    });
  } finally {
    restoreAll();
  }
});
