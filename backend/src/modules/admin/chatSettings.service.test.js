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
const envelope = require('../../crypto/envelope');
const service = require('./chatSettings.service');

/* -------------------------------------------------------------------------- */
/* Mock helpers -- direct require() + reassignment, restored in `finally`,    */
/* same style as chat.service.test.js.                                        */
/* -------------------------------------------------------------------------- */

const originals = {
  chatSettingsFindFirst: prisma.chatSettings.findFirst,
  chatSettingsUpdate: prisma.chatSettings.update,
  chatSettingsCreate: prisma.chatSettings.create,
  envelopeEncrypt: envelope.encrypt,
};

function restoreAll() {
  prisma.chatSettings.findFirst = originals.chatSettingsFindFirst;
  prisma.chatSettings.update = originals.chatSettingsUpdate;
  prisma.chatSettings.create = originals.chatSettingsCreate;
  envelope.encrypt = originals.envelopeEncrypt;
}

/* -------------------------------------------------------------------------- */
/* getChatSettings                                                             */
/* -------------------------------------------------------------------------- */

test('getChatSettings: strips providerApiKeyEncrypted and reports hasApiKey: true when a key is set', async () => {
  prisma.chatSettings.findFirst = async () => ({
    id: 'cs-1',
    provider: 'ANTHROPIC',
    model: 'claude-sonnet-4-5',
    providerApiKeyEncrypted: 'super-secret-encrypted-blob',
    updatedAt: new Date(),
  });

  try {
    const result = await service.getChatSettings();

    assert.equal(result.hasApiKey, true);
    assert.equal('providerApiKeyEncrypted' in result, false);
    assert.equal(JSON.stringify(result).includes('super-secret-encrypted-blob'), false);
  } finally {
    restoreAll();
  }
});

test('getChatSettings: reports hasApiKey: false when providerApiKeyEncrypted is null', async () => {
  prisma.chatSettings.findFirst = async () => ({
    id: 'cs-1',
    provider: 'ANTHROPIC',
    model: 'claude-sonnet-4-5',
    providerApiKeyEncrypted: null,
    updatedAt: new Date(),
  });

  try {
    const result = await service.getChatSettings();
    assert.equal(result.hasApiKey, false);
    assert.equal('providerApiKeyEncrypted' in result, false);
  } finally {
    restoreAll();
  }
});

test('getChatSettings: returns null when there is no row at all', async () => {
  prisma.chatSettings.findFirst = async () => null;

  try {
    const result = await service.getChatSettings();
    assert.equal(result, null);
  } finally {
    restoreAll();
  }
});

/* -------------------------------------------------------------------------- */
/* updateChatSettings                                                          */
/* -------------------------------------------------------------------------- */

test('updateChatSettings: providing apiKey calls envelope.encrypt and stores the result as providerApiKeyEncrypted', async () => {
  prisma.chatSettings.findFirst = async () => ({ id: 'cs-1' });

  let encryptCalledWith;
  envelope.encrypt = (plaintext) => {
    encryptCalledWith = plaintext;
    return 'encrypted-blob-xyz';
  };

  let capturedUpdateArgs;
  prisma.chatSettings.update = async (args) => {
    capturedUpdateArgs = args;
    return { id: 'cs-1', ...args.data, providerApiKeyEncrypted: args.data.providerApiKeyEncrypted };
  };

  try {
    const result = await service.updateChatSettings({
      provider: 'ANTHROPIC',
      model: 'claude-sonnet-4-5',
      apiKey: 'sk-my-new-key',
    });

    assert.equal(encryptCalledWith, 'sk-my-new-key');
    assert.equal(capturedUpdateArgs.where.id, 'cs-1');
    assert.equal(capturedUpdateArgs.data.providerApiKeyEncrypted, 'encrypted-blob-xyz');
    assert.equal('apiKey' in capturedUpdateArgs.data, false);
    assert.equal(result.hasApiKey, true);
    assert.equal('providerApiKeyEncrypted' in result, false);
  } finally {
    restoreAll();
  }
});

test('updateChatSettings: omitting apiKey on an update to an existing row leaves providerApiKeyEncrypted completely untouched', async () => {
  prisma.chatSettings.findFirst = async () => ({ id: 'cs-1' });
  envelope.encrypt = () => {
    throw new Error('envelope.encrypt must not be called when apiKey is omitted');
  };

  let capturedUpdateArgs;
  prisma.chatSettings.update = async (args) => {
    capturedUpdateArgs = args;
    return { id: 'cs-1', ...args.data, providerApiKeyEncrypted: 'still-the-old-blob' };
  };

  try {
    const result = await service.updateChatSettings({
      provider: 'ANTHROPIC',
      model: 'claude-sonnet-4-5',
    });

    // The stored key must be left completely untouched: the mocked update's
    // `data` object must carry no providerApiKeyEncrypted/apiKey key at all.
    assert.equal('providerApiKeyEncrypted' in capturedUpdateArgs.data, false);
    assert.equal('apiKey' in capturedUpdateArgs.data, false);
    assert.equal(result.hasApiKey, true);
  } finally {
    restoreAll();
  }
});

test('updateChatSettings: creates a new row when none exists yet', async () => {
  prisma.chatSettings.findFirst = async () => null;

  let capturedCreateArgs;
  prisma.chatSettings.create = async (args) => {
    capturedCreateArgs = args;
    return { id: 'cs-new', ...args.data, providerApiKeyEncrypted: null };
  };
  prisma.chatSettings.update = async () => {
    throw new Error('update must not be called when no row exists');
  };

  try {
    const result = await service.updateChatSettings({
      provider: 'OPENAI',
      model: 'gpt-5',
    });

    assert.deepEqual(capturedCreateArgs.data, { provider: 'OPENAI', model: 'gpt-5' });
    assert.equal(result.hasApiKey, false);
  } finally {
    restoreAll();
  }
});
