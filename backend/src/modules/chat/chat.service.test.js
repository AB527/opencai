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
const orchestrator = require('../../ai/orchestrator');
const { ERROR_CODES } = require('../../constants/errors');
const { CHAT_MESSAGE_STATUS } = require('../../constants/chatMessageStatus');
const service = require('./chat.service');

/* -------------------------------------------------------------------------- */
/* Mock helpers -- direct require() + reassignment, restored in `finally`,    */
/* same style as systemPrompt.service.test.js.                                */
/* -------------------------------------------------------------------------- */

const originals = {
  chatSessionFindFirst: prisma.chatSession.findFirst,
  chatSessionCreate: prisma.chatSession.create,
  chatSettingsFindFirst: prisma.chatSettings.findFirst,
  chatMessageFindFirst: prisma.chatMessage.findFirst,
  workspaceFindUnique: prisma.workspace.findUnique,
  userOrganisationFindUnique: prisma.userOrganisation.findUnique,
  agentPersonaFindUnique: prisma.agentPersona.findUnique,
  envelopeDecrypt: envelope.decrypt,
  handleUserMessage: orchestrator.handleUserMessage,
  confirmCommand: orchestrator.confirmCommand,
  cancelCommand: orchestrator.cancelCommand,
};

function restoreAll() {
  prisma.chatSession.findFirst = originals.chatSessionFindFirst;
  prisma.chatSession.create = originals.chatSessionCreate;
  prisma.chatSettings.findFirst = originals.chatSettingsFindFirst;
  prisma.chatMessage.findFirst = originals.chatMessageFindFirst;
  prisma.workspace.findUnique = originals.workspaceFindUnique;
  prisma.userOrganisation.findUnique = originals.userOrganisationFindUnique;
  prisma.agentPersona.findUnique = originals.agentPersonaFindUnique;
  envelope.decrypt = originals.envelopeDecrypt;
  orchestrator.handleUserMessage = originals.handleUserMessage;
  orchestrator.confirmCommand = originals.confirmCommand;
  orchestrator.cancelCommand = originals.cancelCommand;
}

const USER_ID = 'user-1';
const SESSION_ID = 'sess-1';
const MESSAGE_ID = 'msg-1';

function makeFullSession(over = {}) {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    workspaceId: 'ws-1',
    mode: 'AIOPS',
    subMode: null,
    mutatingCommandCap: 10,
    mutatingCommandCount: 0,
    sandboxContainerId: null,
    sandboxStatus: null,
    sandboxExpiresAt: null,
    workspace: {
      id: 'ws-1',
      csp: 'AWS',
      credential: {
        id: 'cred-1',
        workspaceId: 'ws-1',
        encryptedCredentials: 'enc-blob',
      },
    },
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* sendMessage                                                                 */
/* -------------------------------------------------------------------------- */

test('sendMessage: happy path calls orchestrator.handleUserMessage with the decrypted credential', async () => {
  const session = makeFullSession();
  const capturedFindFirstArgs = [];

  prisma.chatSession.findFirst = async (args) => {
    capturedFindFirstArgs.push(args);
    return session;
  };
  prisma.chatMessage.findFirst = async () => null;
  envelope.decrypt = (blob) => {
    assert.equal(blob, 'enc-blob');
    return JSON.stringify({ accessKeyId: 'AKIA', secretAccessKey: 'shh' });
  };

  let handleArgs;
  orchestrator.handleUserMessage = async (args) => {
    handleArgs = args;
    return { messages: [{ id: 'm1' }] };
  };

  try {
    const result = await service.sendMessage(USER_ID, SESSION_ID, 'list instances');

    assert.deepEqual(result, { messages: [{ id: 'm1' }] });
    assert.deepEqual(handleArgs, {
      session,
      workspace: session.workspace,
      credential: { accessKeyId: 'AKIA', secretAccessKey: 'shh' },
      userId: USER_ID,
      text: 'list instances',
    });
    // Assert the actual decrypted credential object was passed, not the
    // encrypted blob.
    assert.notEqual(handleArgs.credential, session.workspace.credential.encryptedCredentials);

    assert.equal(capturedFindFirstArgs[0].where.id, SESSION_ID);
    assert.equal(capturedFindFirstArgs[0].where.userId, USER_ID);
    assert.deepEqual(capturedFindFirstArgs[0].include, {
      workspace: { include: { credential: true } },
    });
  } finally {
    restoreAll();
  }
});

test('sendMessage: 404 when the session does not belong to the calling user (or does not exist)', async () => {
  prisma.chatSession.findFirst = async () => null;
  orchestrator.handleUserMessage = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.sendMessage(USER_ID, SESSION_ID, 'hi'),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.code, ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

test('sendMessage: 422 when the workspace has no WorkspaceCredential row', async () => {
  const session = makeFullSession({ workspace: { id: 'ws-1', csp: 'AWS', credential: null } });
  prisma.chatSession.findFirst = async () => session;
  envelope.decrypt = () => {
    throw new Error('should not be called -- no credential to decrypt');
  };
  orchestrator.handleUserMessage = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.sendMessage(USER_ID, SESSION_ID, 'hi'),
      (err) => {
        assert.equal(err.status, 422);
        assert.equal(err.code, ERROR_CODES.WORKSPACE_CREDENTIAL_MISSING);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

test('sendMessage: 409 when an existing PENDING_CONFIRMATION message already exists', async () => {
  const session = makeFullSession();
  prisma.chatSession.findFirst = async () => session;
  envelope.decrypt = () => JSON.stringify({ accessKeyId: 'AKIA' });

  let capturedPendingWhere;
  prisma.chatMessage.findFirst = async (args) => {
    capturedPendingWhere = args.where;
    return { id: 'pending-1', status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION };
  };
  orchestrator.handleUserMessage = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.sendMessage(USER_ID, SESSION_ID, 'hi'),
      (err) => {
        assert.equal(err.status, 409);
        assert.equal(err.code, ERROR_CODES.PENDING_COMMAND_EXISTS);
        return true;
      },
    );
    assert.deepEqual(capturedPendingWhere, {
      sessionId: SESSION_ID,
      status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
    });
  } finally {
    restoreAll();
  }
});

/* -------------------------------------------------------------------------- */
/* confirmPendingCommand                                                       */
/* -------------------------------------------------------------------------- */

test('confirmPendingCommand: happy path calls orchestrator.confirmCommand with the correct shape', async () => {
  const session = makeFullSession();
  prisma.chatSession.findFirst = async () => session;
  envelope.decrypt = () => JSON.stringify({ accessKeyId: 'AKIA' });

  let confirmArgs;
  orchestrator.confirmCommand = async (args) => {
    confirmArgs = args;
    return { messages: [{ id: 'm2' }] };
  };

  try {
    const result = await service.confirmPendingCommand(USER_ID, SESSION_ID, MESSAGE_ID);

    assert.deepEqual(result, { messages: [{ id: 'm2' }] });
    assert.deepEqual(confirmArgs, {
      session,
      workspace: session.workspace,
      credential: { accessKeyId: 'AKIA' },
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });
  } finally {
    restoreAll();
  }
});

test('confirmPendingCommand: 404 when the session does not belong to the calling user', async () => {
  prisma.chatSession.findFirst = async () => null;
  orchestrator.confirmCommand = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.confirmPendingCommand(USER_ID, SESSION_ID, MESSAGE_ID),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.code, ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

test('confirmPendingCommand: 422 when the workspace has no WorkspaceCredential row', async () => {
  const session = makeFullSession({ workspace: { id: 'ws-1', csp: 'AWS', credential: null } });
  prisma.chatSession.findFirst = async () => session;
  orchestrator.confirmCommand = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.confirmPendingCommand(USER_ID, SESSION_ID, MESSAGE_ID),
      (err) => {
        assert.equal(err.status, 422);
        assert.equal(err.code, ERROR_CODES.WORKSPACE_CREDENTIAL_MISSING);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

/* -------------------------------------------------------------------------- */
/* cancelPendingCommand                                                        */
/* -------------------------------------------------------------------------- */

test('cancelPendingCommand: happy path calls orchestrator.cancelCommand and never decrypts a credential', async () => {
  // A bare (narrow) session row -- as prisma.chatSession.findFirst without an
  // `include` would return -- proving cancelPendingCommand does not need
  // (and does not fetch) workspace/credential data at all.
  const bareSession = {
    id: SESSION_ID,
    userId: USER_ID,
    workspaceId: 'ws-1',
    mode: 'AIOPS',
    subMode: null,
    mutatingCommandCap: 10,
    mutatingCommandCount: 0,
  };

  let capturedFindFirstArgs;
  prisma.chatSession.findFirst = async (args) => {
    capturedFindFirstArgs = args;
    return bareSession;
  };
  envelope.decrypt = () => {
    throw new Error('envelope.decrypt must never be called by cancelPendingCommand');
  };

  let cancelArgs;
  orchestrator.cancelCommand = async (args) => {
    cancelArgs = args;
    return { messages: [{ id: 'm3' }] };
  };

  try {
    const result = await service.cancelPendingCommand(USER_ID, SESSION_ID, MESSAGE_ID);

    assert.deepEqual(result, { messages: [{ id: 'm3' }] });
    assert.deepEqual(cancelArgs, {
      session: bareSession,
      messageId: MESSAGE_ID,
      userId: USER_ID,
    });
    // No `include` -- loadSessionWithCredential (and its workspace/credential
    // fetch) was never invoked.
    assert.equal(capturedFindFirstArgs.include, undefined);
  } finally {
    restoreAll();
  }
});

test('cancelPendingCommand: 404 when the session does not belong to the calling user', async () => {
  prisma.chatSession.findFirst = async () => null;
  orchestrator.cancelCommand = async () => {
    throw new Error('should not be called');
  };
  envelope.decrypt = () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.cancelPendingCommand(USER_ID, SESSION_ID, MESSAGE_ID),
      (err) => {
        assert.equal(err.status, 404);
        assert.equal(err.code, ERROR_CODES.NOT_FOUND);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

/* -------------------------------------------------------------------------- */
/* createSession -- mutating-command cap snapshot                             */
/* -------------------------------------------------------------------------- */

function setupCreateSessionMocks({ personaCap, settingsDefault }) {
  prisma.workspace.findUnique = async () => ({ id: 'ws-1', organisationId: 'org-1' });
  prisma.userOrganisation.findUnique = async () => ({ userId: USER_ID, organisationId: 'org-1' });
  // getPersona is imported into chat.service.js via destructuring, so it must
  // be driven through its own collaborator (prisma.agentPersona.findUnique)
  // rather than reassigning systemPromptService.getPersona, which chat.service
  // no longer holds a live reference to once destructured at require time.
  prisma.agentPersona.findUnique = async () => ({
    systemPrompt: 'persona text',
    allowedBinaries: ['aws'],
    mutatingCommandCap: personaCap,
    docLookupAllowed: true,
  });
  prisma.chatSettings.findFirst = async () =>
    settingsDefault === undefined
      ? null
      : { maxMutatingCommandsPerSessionDefault: settingsDefault };

  let capturedCreateData;
  prisma.chatSession.create = async ({ data }) => {
    capturedCreateData = data;
    return { id: 'new-sess', ...data };
  };
  return () => capturedCreateData;
}

test('createSession: a persona with a non-null mutatingCommandCap wins over ChatSettings default', async () => {
  const getData = setupCreateSessionMocks({ personaCap: 3, settingsDefault: 25 });

  try {
    await service.createSession(USER_ID, { workspaceId: 'ws-1', mode: 'AIOPS' });
    assert.equal(getData().mutatingCommandCap, 3);
  } finally {
    restoreAll();
  }
});

test('createSession: a null persona cap falls back to ChatSettings.maxMutatingCommandsPerSessionDefault', async () => {
  const getData = setupCreateSessionMocks({ personaCap: null, settingsDefault: 25 });

  try {
    await service.createSession(USER_ID, { workspaceId: 'ws-1', mode: 'AIOPS' });
    assert.equal(getData().mutatingCommandCap, 25);
  } finally {
    restoreAll();
  }
});

test('createSession: both persona cap and ChatSettings missing falls back to the literal 10', async () => {
  const getData = setupCreateSessionMocks({ personaCap: null, settingsDefault: undefined });

  try {
    await service.createSession(USER_ID, { workspaceId: 'ws-1', mode: 'AIOPS' });
    assert.equal(getData().mutatingCommandCap, 10);
  } finally {
    restoreAll();
  }
});
