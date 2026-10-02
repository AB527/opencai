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
  chatSessionUpdateMany: prisma.chatSession.updateMany,
  chatSessionFindUnique: prisma.chatSession.findUnique,
  chatSessionFindMany: prisma.chatSession.findMany,
  chatSessionCount: prisma.chatSession.count,
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
  prisma.chatSession.updateMany = originals.chatSessionUpdateMany;
  prisma.chatSession.findUnique = originals.chatSessionFindUnique;
  prisma.chatSession.findMany = originals.chatSessionFindMany;
  prisma.chatSession.count = originals.chatSessionCount;
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
      isActive: true,
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
  const session = makeFullSession({ title: 'already titled' });
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

test('sendMessage: 403 when the workspace has been deactivated', async () => {
  const base = makeFullSession();
  const session = { ...base, workspace: { ...base.workspace, isActive: false } };
  prisma.chatSession.findFirst = async () => session;
  orchestrator.handleUserMessage = async () => {
    throw new Error('should not be called');
  };

  try {
    await assert.rejects(
      () => service.sendMessage(USER_ID, SESSION_ID, 'hi'),
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, ERROR_CODES.WORKSPACE_INACTIVE);
        return true;
      },
    );
  } finally {
    restoreAll();
  }
});

test('sendMessage: 422 when the workspace has no WorkspaceCredential row', async () => {
  const session = makeFullSession({
    workspace: { id: 'ws-1', csp: 'AWS', isActive: true, credential: null },
  });
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
  const session = makeFullSession({
    workspace: { id: 'ws-1', csp: 'AWS', isActive: true, credential: null },
  });
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
  prisma.workspace.findUnique = async () => ({
    id: 'ws-1',
    organisationId: 'org-1',
    isActive: true,
  });
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

test('createSession: 403 in a deactivated workspace, and nothing is created', async () => {
  const getData = setupCreateSessionMocks({ personaCap: 3, settingsDefault: 25 });
  prisma.workspace.findUnique = async () => ({
    id: 'ws-1',
    organisationId: 'org-1',
    isActive: false,
  });

  try {
    await assert.rejects(
      () => service.createSession(USER_ID, { workspaceId: 'ws-1', mode: 'AIOPS' }),
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.code, ERROR_CODES.WORKSPACE_INACTIVE);
        return true;
      },
    );
    assert.equal(getData(), undefined);
  } finally {
    restoreAll();
  }
});

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

/* -------------------------------------------------------------------------- */
/* Session titles                                                              */
/* -------------------------------------------------------------------------- */

test('titleFromMessage: collapses whitespace and cuts long text at a word boundary', () => {
  assert.equal(service.titleFromMessage('  how many\n  ec2 instances  '), 'how many ec2 instances');
  const long = 'list every running ec2 instance in ap-south-1 with its type and launch time please';
  const title = service.titleFromMessage(long);
  assert.ok(title.endsWith('…'));
  assert.ok(title.length <= 61);
  assert.ok(long.startsWith(title.slice(0, -1)));
  assert.equal(title.at(-2) === ' ', false);
});

test('sendMessage: an untitled session is titled from the first message, guarded on title: null', async () => {
  prisma.chatSession.findFirst = async () => makeFullSession({ title: null });
  prisma.chatMessage.findFirst = async () => null;
  envelope.decrypt = () => JSON.stringify({ accessKeyId: 'AKIA', secretAccessKey: 'shh' });
  orchestrator.handleUserMessage = async () => ({ messages: [] });
  let updateArgs;
  prisma.chatSession.updateMany = async (args) => {
    updateArgs = args;
    return { count: 1 };
  };

  try {
    await service.sendMessage(USER_ID, SESSION_ID, 'how many instances');
    assert.deepEqual(updateArgs, {
      where: { id: SESSION_ID, title: null },
      data: { title: 'how many instances' },
    });
  } finally {
    restoreAll();
  }
});

test('sendMessage: a titled session keeps its title', async () => {
  prisma.chatSession.findFirst = async () => makeFullSession({ title: 'My renamed chat' });
  prisma.chatMessage.findFirst = async () => null;
  envelope.decrypt = () => JSON.stringify({ accessKeyId: 'AKIA', secretAccessKey: 'shh' });
  orchestrator.handleUserMessage = async () => ({ messages: [] });
  let updated = false;
  prisma.chatSession.updateMany = async () => {
    updated = true;
    return { count: 1 };
  };

  try {
    await service.sendMessage(USER_ID, SESSION_ID, 'next question');
    assert.equal(updated, false);
  } finally {
    restoreAll();
  }
});

test('renameSession: updates only the caller-owned session and returns it', async () => {
  let updateArgs;
  prisma.chatSession.updateMany = async (args) => {
    updateArgs = args;
    return { count: 1 };
  };
  prisma.chatSession.findUnique = async () => ({ id: SESSION_ID, title: 'Prod audit' });

  try {
    const result = await service.renameSession(USER_ID, SESSION_ID, 'Prod audit');
    assert.deepEqual(updateArgs, {
      where: { id: SESSION_ID, userId: USER_ID },
      data: { title: 'Prod audit' },
    });
    assert.equal(result.title, 'Prod audit');
  } finally {
    restoreAll();
  }
});

test("renameSession: 404 for another user's (or a missing) session", async () => {
  prisma.chatSession.updateMany = async () => ({ count: 0 });

  try {
    await assert.rejects(
      () => service.renameSession(USER_ID, SESSION_ID, 'x'),
      (err) => err.status === 404 && err.code === ERROR_CODES.NOT_FOUND,
    );
  } finally {
    restoreAll();
  }
});

test('listSessions: hasMessages filters out unused sessions and search covers titles', async () => {
  let where;
  prisma.chatSession.findMany = async (args) => {
    where = args.where;
    return [];
  };
  prisma.chatSession.count = async () => 0;

  try {
    await service.listSessions(USER_ID, {
      mode: 'AIOPS',
      hasMessages: true,
      search: 'audit',
      page: 1,
      pageSize: 5,
    });
    assert.equal(where.userId, USER_ID);
    assert.equal(where.mode, 'AIOPS');
    assert.deepEqual(where.messages, { some: {} });
    assert.deepEqual(where.OR[0], { title: { contains: 'audit', mode: 'insensitive' } });

    await service.listSessions(USER_ID, { page: 1, pageSize: 5 });
    assert.equal(where.messages, undefined);
  } finally {
    restoreAll();
  }
});
