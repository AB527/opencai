const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Every collaborator is stubbed before orchestrator.js loads it: no database,
// no Docker daemon, no LLM calls. Same require.cache injection style as
// sandboxManager.test.js.
function inject(request, exports) {
  const resolved = require.resolve(request);
  require.cache[resolved] = new Module(resolved, null);
  require.cache[resolved].filename = resolved;
  require.cache[resolved].loaded = true;
  require.cache[resolved].exports = exports;
}

/* -------------------------------------------------------------------------- */
/* Mutable test state, shared by all the stubs below                           */
/* -------------------------------------------------------------------------- */

const S = {};
let idCounter = 0;
let clock = 0;

function reset() {
  idCounter = 0;
  clock = 0;
  S.settings = {
    id: 'settings-1',
    provider: 'ANTHROPIC',
    model: 'claude-test',
    config: { temperature: 0.1 },
    providerApiKeyEncrypted: 'enc-blob',
    baseUrl: null,
    sandboxCommandTimeoutSeconds: 60,
    sandboxIdleTimeoutMinutes: 30,
  };
  S.messages = [];
  S.created = [];
  S.audits = [];
  S.messageUpdateManyArgs = [];
  S.sessionUpdateManyArgs = [];
  S.claimCounts = [];
  S.capCounts = [];
  S.sessionRow = null;

  S.persona = {
    systemPrompt: 'PERSONA PROMPT',
    allowedBinaries: ['aws'],
    mutatingCommandCap: null,
    docLookupAllowed: true,
  };

  S.providerResponses = [];
  S.providerCalls = [];
  S.classifyResults = [];
  S.classifyCalls = [];
  S.execCalls = [];
  S.execResults = [];
  S.provisionCalls = [];
  S.provisionError = null;
  S.envResult = { AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', AWS_SECRET_ACCESS_KEY: 'shh' };
}

function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function nextDate() {
  clock += 1;
  return new Date(1700000000000 + clock * 1000);
}

/* -------------------------------------------------------------------------- */
/* Stubs                                                                       */
/* -------------------------------------------------------------------------- */

const fakePrisma = {
  chatSettings: {
    async findFirst() {
      return S.settings;
    },
  },
  chatMessage: {
    async create({ data }) {
      const row = {
        id: nextId('msg'),
        sessionId: data.sessionId,
        role: data.role,
        kind: data.kind,
        content: data.content,
        commandOutput: data.commandOutput ?? null,
        status: data.status ?? null,
        createdAt: nextDate(),
      };
      S.messages.push(row);
      S.created.push(row);
      return row;
    },
    async findUnique({ where }) {
      const row = S.messages.find((m) => m.id === where.id);
      return row ? { ...row } : null;
    },
    async findMany({ where, orderBy, take }) {
      let rows = S.messages.filter((m) => m.sessionId === where.sessionId);
      if (where.id?.notIn) {
        rows = rows.filter((m) => !where.id.notIn.includes(m.id));
      }
      const dir = orderBy?.createdAt === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => dir * (a.createdAt - b.createdAt));
      return typeof take === 'number' ? rows.slice(0, take) : rows;
    },
    async update({ where, data }) {
      const row = S.messages.find((m) => m.id === where.id);
      if (!row) throw new Error(`no such message ${where.id}`);
      Object.assign(row, data);
      return { ...row };
    },
    async updateMany(args) {
      S.messageUpdateManyArgs.push(args);
      if (S.claimCounts.length > 0) return { count: S.claimCounts.shift() };
      // Realistic emulation: only a row still in the expected status matches.
      const matches = S.messages.filter(
        (m) =>
          m.id === args.where.id &&
          m.sessionId === args.where.sessionId &&
          m.status === args.where.status,
      );
      matches.forEach((m) => Object.assign(m, args.data));
      return { count: matches.length };
    },
  },
  chatSession: {
    async updateMany(args) {
      S.sessionUpdateManyArgs.push(args);
      if (S.capCounts.length > 0) return { count: S.capCounts.shift() };
      const lt = args.where.mutatingCommandCount?.lt;
      if (S.sessionRow && S.sessionRow.mutatingCommandCount < lt) {
        S.sessionRow.mutatingCommandCount += 1;
        return { count: 1 };
      }
      return { count: 0 };
    },
  },
  auditLog: {
    async create({ data }) {
      S.audits.push(data);
      return { id: nextId('audit'), ...data };
    },
  },
};

const fakeProviderModule = {
  async sendMessage(args) {
    S.providerCalls.push(args);
    if (S.providerResponses.length === 0) {
      // Sentinel: tests assert on S.providerCalls.length, so an unexpected
      // extra call shows up as both a surplus call and a recognisable message.
      return { type: 'text', content: '__UNEXPECTED_EXTRA_PROVIDER_CALL__' };
    }
    return S.providerResponses.shift();
  },
};

inject('../config/db', fakePrisma);
inject('../crypto/envelope', { decrypt: (serialized) => `decrypted:${serialized}` });
inject('./providers', { getProvider: () => fakeProviderModule });
inject('./systemPrompt.service', { getPersona: async () => S.persona });
inject('./policy/commandPolicy', {
  classify: (args) => {
    S.classifyCalls.push(args);
    if (S.classifyResults.length === 0) throw new Error('unexpected classify() call');
    return S.classifyResults.shift();
  },
});
inject('./credentials', {
  credentialToEnv: (csp, credentialJson) => {
    S.envCall = { csp, credentialJson };
    return S.envResult;
  },
});
inject('./sandbox/sandboxManager', {
  async provisionSandbox(session, options) {
    S.provisionCalls.push({ session, options });
    if (S.provisionError) throw S.provisionError;
    return { containerId: 'cid-1' };
  },
  async executeInSandbox(containerId, argv, options) {
    S.execCalls.push({ containerId, argv, options });
    if (S.execResults.length === 0) {
      return { stdout: 'default-output', stderr: '', exitCode: 0, timedOut: false };
    }
    const next = S.execResults.shift();
    if (next instanceof Error) throw next;
    return next;
  },
  async destroySandbox() {},
});

const { handleUserMessage, confirmCommand, cancelCommand } = require('./orchestrator');
const { CHAT_MESSAGE_STATUS } = require('../constants/chatMessageStatus');
const { AUDIT_ACTIONS, AUDIT_OUTCOMES } = require('../constants/auditActions');
const { ERROR_CODES } = require('../constants/errors');
const { POLICY_VERDICTS } = require('./policy/policyVerdicts');

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const WORKSPACE = { id: 'ws-1', csp: 'AWS' };
const CREDENTIAL = { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'shh' };

function makeSession(over = {}) {
  const session = {
    id: 'sess-1',
    userId: 'user-1',
    workspaceId: 'ws-1',
    mode: 'AIOPS',
    subMode: null,
    mutatingCommandCap: 10,
    mutatingCommandCount: 0,
    sandboxContainerId: null,
    sandboxStatus: null,
    ...over,
  };
  S.sessionRow = session;
  return session;
}

function verdict(over) {
  return {
    verdict: POLICY_VERDICTS.ALLOW_READONLY,
    reason: null,
    dryRunCapable: false,
    argv: ['aws', 'ec2', 'describe-instances'],
    binary: 'aws',
    verb: 'describe-instances',
    ...over,
  };
}

/** Seed a PENDING_CONFIRMATION COMMAND_REQUEST row directly into the fake DB. */
function seedPendingCommand(sessionId, content) {
  const row = {
    id: nextId('msg'),
    sessionId,
    role: 'ASSISTANT',
    kind: 'COMMAND_REQUEST',
    content,
    commandOutput: null,
    status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
    createdAt: nextDate(),
  };
  S.messages.push(row);
  return row;
}

function kinds(messages) {
  return messages.map((m) => `${m.role}/${m.kind}/${m.status ?? 'null'}`);
}

/* -------------------------------------------------------------------------- */
/* handleUserMessage                                                           */
/* -------------------------------------------------------------------------- */

test('plain text response ends the turn with one assistant TEXT row and no execution', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [{ type: 'text', content: 'Here is your answer.' }];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'how many instances do I have?',
  });

  assert.deepEqual(kinds(messages), ['USER/TEXT/null', 'ASSISTANT/TEXT/null']);
  assert.equal(messages[0].content, 'how many instances do I have?');
  assert.equal(messages[1].content, 'Here is your answer.');
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 1);
  assert.equal(S.audits.length, 0);
  // The system prompt travels as a provider argument, never as a chat row.
  assert.equal(S.providerCalls[0].systemPrompt, 'PERSONA PROMPT');
  assert.equal(
    messages.some((m) => m.role === 'SYSTEM'),
    false,
  );
});

test('lookup request executes immediately and the loop continues for another turn', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    { type: 'lookup_request', content: 'aws ec2 --help', command: 'aws ec2 --help' },
    { type: 'text', content: 'That help text says...' },
  ];
  S.classifyResults = [
    verdict({ verdict: POLICY_VERDICTS.ALLOW_LOOKUP, argv: ['aws', 'ec2', '--help'] }),
  ];
  S.execResults = [{ stdout: 'usage: aws ec2', stderr: '', exitCode: 0, timedOut: false }];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'how do I use ec2?',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/LOOKUP_REQUEST/EXECUTED',
    'ASSISTANT/COMMAND_RESULT/EXECUTED',
    'ASSISTANT/TEXT/null',
  ]);
  assert.equal(messages[1].content, 'aws ec2 --help');
  assert.equal(messages[2].content, 'usage: aws ec2');
  assert.equal(messages[2].commandOutput, 'usage: aws ec2');
  assert.equal(messages[3].content, 'That help text says...');

  assert.equal(S.providerCalls.length, 2);
  assert.equal(S.execCalls.length, 1);
  assert.deepEqual(S.execCalls[0].argv, ['aws', 'ec2', '--help']);
  assert.equal(S.execCalls[0].containerId, 'cid-1');
  assert.equal(S.execCalls[0].options.timeoutSeconds, 60);
  assert.deepEqual(S.execCalls[0].options.env, S.envResult);

  // The execution result is fed back to the model as the next trigger turn.
  const secondCall = S.providerCalls[1];
  assert.equal(secondCall.newMessage, 'Result:\nusage: aws ec2');
  assert.deepEqual(secondCall.history.at(-1), {
    role: 'assistant',
    content: '[proposed] aws ec2 --help',
  });

  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.LOOKUP_EXECUTED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.SUCCESS);
  assert.deepEqual(S.audits[0].metadata.command, ['aws', 'ec2', '--help']);
  assert.equal(S.audits[0].actorUserId, 'user-1');
  assert.equal(S.audits[0].workspaceId, 'ws-1');
  assert.equal(S.audits[0].chatSessionId, 'sess-1');
});

test('read-only command executes immediately as a COMMAND_REQUEST/COMMAND_RESULT pair', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    {
      type: 'command_request',
      content: 'aws ec2 describe-instances',
      command: 'aws ec2 describe-instances',
    },
    { type: 'text', content: 'You have 3 instances.' },
  ];
  S.classifyResults = [verdict({ verdict: POLICY_VERDICTS.ALLOW_READONLY })];
  S.execResults = [{ stdout: 'out', stderr: 'warn', exitCode: 1, timedOut: false }];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'list instances',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/EXECUTED',
    'ASSISTANT/COMMAND_RESULT/EXECUTED',
    'ASSISTANT/TEXT/null',
  ]);
  // Both streams are sanitized and combined into one blob, stored twice.
  assert.equal(messages[2].content, 'out\nwarn');
  assert.equal(messages[2].commandOutput, 'out\nwarn');
  assert.equal(messages[2].content, messages[2].commandOutput);

  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_EXECUTED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.FAILURE);
  assert.equal(S.audits[0].metadata.exitCode, 1);
  assert.equal(S.audits[0].metadata.timedOut, false);
});

test('mutating command with dryRunCapable produces PENDING_CONFIRMATION + DRY_RUN and stops', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    {
      type: 'command_request',
      content: 'aws ec2 terminate-instances --instance-ids i-1',
      command: 'aws ec2 terminate-instances --instance-ids i-1',
    },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: true,
      argv: ['aws', 'ec2', 'terminate-instances', '--instance-ids', 'i-1'],
      verb: 'terminate-instances',
    }),
  ];
  S.execResults = [{ stdout: 'DryRunOperation', stderr: '', exitCode: 0, timedOut: false }];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'kill i-1',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/PENDING_CONFIRMATION',
    'ASSISTANT/COMMAND_RESULT/DRY_RUN',
  ]);
  assert.equal(messages[1].content, 'aws ec2 terminate-instances --instance-ids i-1');
  assert.equal(messages[2].content, 'DryRunOperation');
  assert.equal(messages[2].commandOutput, 'DryRunOperation');

  // The loop stops at the confirmation gate: exactly one provider call.
  assert.equal(S.providerCalls.length, 1);
  assert.equal(S.execCalls.length, 1);
  assert.deepEqual(S.execCalls[0].argv, [
    'aws',
    'ec2',
    'terminate-instances',
    '--instance-ids',
    'i-1',
    '--dry-run',
  ]);

  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_PROPOSED);
  assert.equal(S.audits[0].outcome, null);
});

test('mutating command without dry-run support produces only the PENDING_CONFIRMATION row', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    { type: 'command_request', content: 'aws s3 rb s3://b', command: 'aws s3 rb s3://b' },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
      verb: 'rb',
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'delete bucket b',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/PENDING_CONFIRMATION',
  ]);
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 1);
});

test('dry-run that throws still yields a COMMAND_RESULT row and does not break the turn', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    {
      type: 'command_request',
      content: 'aws ec2 stop-instances --instance-ids i-2',
      command: 'aws ec2 stop-instances --instance-ids i-2',
    },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: true,
      argv: ['aws', 'ec2', 'stop-instances', '--instance-ids', 'i-2'],
    }),
  ];
  S.execResults = [new Error('docker exploded')];

  const originalError = console.error;
  console.error = () => {};
  let messages;
  try {
    ({ messages } = await handleUserMessage({
      session,
      workspace: WORKSPACE,
      credential: CREDENTIAL,
      userId: 'user-1',
      text: 'stop i-2',
    }));
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/PENDING_CONFIRMATION',
    'ASSISTANT/COMMAND_RESULT/DRY_RUN',
  ]);
  assert.equal(messages[2].content, '(dry-run failed to execute)');
});

test('REJECTED classification produces the request row plus an explanation and stops', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [{ type: 'command_request', content: 'rm -rf /', command: 'rm -rf /' }];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REJECTED,
      reason: 'Binary "rm" is not allowed in this mode',
      argv: ['rm', '-rf', '/'],
      binary: 'rm',
      verb: null,
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'wipe it',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/REJECTED',
    'ASSISTANT/TEXT/null',
  ]);
  assert.equal(messages[1].content, 'rm -rf /');
  assert.equal(messages[2].content, 'I can\'t run that: Binary "rm" is not allowed in this mode');
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 1);
  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_REJECTED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.REJECTED);
  assert.deepEqual(S.audits[0].metadata, {
    command: ['rm', '-rf', '/'],
    reason: 'Binary "rm" is not allowed in this mode',
  });
});

test('REJECTED with an unparseable command falls back to the raw string for display only', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [{ type: 'command_request', content: 'aws "', command: 'aws "' }];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REJECTED,
      reason: 'Command could not be parsed',
      argv: [],
      binary: null,
      verb: null,
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'do a thing',
  });

  assert.equal(messages[1].content, 'aws "');
  assert.equal(messages[1].status, CHAT_MESSAGE_STATUS.REJECTED);
  assert.equal(S.execCalls.length, 0);
});

test('reaching the mutating cap short-circuits to CAPPED without ever executing', async () => {
  reset();
  const session = makeSession({ mutatingCommandCap: 2, mutatingCommandCount: 2 });
  S.providerResponses = [
    { type: 'command_request', content: 'aws s3 rb s3://b', command: 'aws s3 rb s3://b' },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: true,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'delete bucket b',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/CAPPED',
    'ASSISTANT/TEXT/null',
  ]);
  assert.equal(
    messages[2].content,
    'This session has reached its limit of 2 mutating commands. Start a new session to continue.',
  );
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 1);
  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.SESSION_CAP_EXCEEDED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.CAPPED);
});

test('a non-empty explanation becomes its own ASSISTANT/TEXT row before the request row', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    {
      type: 'command_request',
      content: 'aws s3 rb s3://b',
      command: 'aws s3 rb s3://b',
      explanation: 'This removes the bucket permanently.',
    },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'delete bucket b',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/PENDING_CONFIRMATION',
  ]);
  assert.equal(messages[1].content, 'This removes the bucket permanently.');
  // Never folded into the request row's content.
  assert.equal(messages[2].content, 'aws s3 rb s3://b');
});

test('a blank/absent explanation does not create an extra row', async () => {
  reset();
  const session = makeSession();
  S.providerResponses = [
    {
      type: 'command_request',
      content: 'aws s3 rb s3://b',
      command: 'aws s3 rb s3://b',
      explanation: '   ',
    },
  ];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'delete bucket b',
  });

  assert.deepEqual(kinds(messages), [
    'USER/TEXT/null',
    'ASSISTANT/COMMAND_REQUEST/PENDING_CONFIRMATION',
  ]);
});

test('persisted command text and audit metadata come from argv, never the raw model string', async () => {
  reset();
  const session = makeSession();
  // shell-quote expands `$FOO` to an empty token, so the raw string the model
  // emitted and the argv that would actually run genuinely differ.
  const rawCommand = 'aws ec2 describe-instances --filters $FOO';
  const realArgv = ['aws', 'ec2', 'describe-instances', '--filters', ''];

  S.providerResponses = [
    { type: 'command_request', content: rawCommand, command: rawCommand },
    { type: 'text', content: 'done' },
  ];
  S.classifyResults = [verdict({ verdict: POLICY_VERDICTS.ALLOW_READONLY, argv: realArgv })];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'list instances',
  });

  assert.equal(messages[1].content, realArgv.join(' '));
  assert.notEqual(messages[1].content, rawCommand);
  assert.deepEqual(S.audits[0].metadata.command, realArgv);
  // And the argv array -- not a joined string -- is what reaches the sandbox.
  assert.deepEqual(S.execCalls[0].argv, realArgv);
  assert.ok(Array.isArray(S.execCalls[0].argv));
});

test('a confirmation-gated proposal persists argv, not the divergent raw command', async () => {
  reset();
  const session = makeSession();
  const rawCommand = 'aws ec2 terminate-instances --instance-ids $TARGET';
  const realArgv = ['aws', 'ec2', 'terminate-instances', '--instance-ids', ''];

  S.providerResponses = [{ type: 'command_request', content: rawCommand, command: rawCommand }];
  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: realArgv,
    }),
  ];

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'terminate it',
  });

  assert.equal(messages[1].content, realArgv.join(' '));
  assert.notEqual(messages[1].content, rawCommand);
  assert.deepEqual(S.audits[0].metadata.command, realArgv);
});

test('history from prior rows is replayed in order and the new user text is the trigger', async () => {
  reset();
  const session = makeSession();
  S.messages.push(
    {
      id: 'old-1',
      sessionId: 'sess-1',
      role: 'USER',
      kind: 'TEXT',
      content: 'hello',
      commandOutput: null,
      status: null,
      createdAt: nextDate(),
    },
    {
      id: 'old-2',
      sessionId: 'sess-1',
      role: 'ASSISTANT',
      kind: 'COMMAND_REQUEST',
      content: 'aws ec2 describe-instances',
      commandOutput: null,
      status: 'EXECUTED',
      createdAt: nextDate(),
    },
    {
      id: 'old-3',
      sessionId: 'sess-1',
      role: 'ASSISTANT',
      kind: 'COMMAND_RESULT',
      content: 'two instances',
      commandOutput: 'two instances',
      status: 'EXECUTED',
      createdAt: nextDate(),
    },
    {
      id: 'other-session',
      sessionId: 'sess-2',
      role: 'USER',
      kind: 'TEXT',
      content: 'not mine',
      commandOutput: null,
      status: null,
      createdAt: nextDate(),
    },
  );
  S.providerResponses = [{ type: 'text', content: 'ok' }];

  await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'and now?',
  });

  const call = S.providerCalls[0];
  assert.deepEqual(call.history, [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: '[proposed] aws ec2 describe-instances' },
    { role: 'user', content: 'Result:\ntwo instances' },
  ]);
  assert.equal(call.newMessage, 'and now?');
});

test('sandbox provisioning failure returns an explanatory row instead of throwing', async () => {
  reset();
  const session = makeSession();
  S.provisionError = new Error('no such image');

  const originalError = console.error;
  console.error = () => {};
  let messages;
  try {
    ({ messages } = await handleUserMessage({
      session,
      workspace: WORKSPACE,
      credential: CREDENTIAL,
      userId: 'user-1',
      text: 'hi',
    }));
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(kinds(messages), ['USER/TEXT/null', 'ASSISTANT/TEXT/null']);
  assert.equal(
    messages[1].content,
    "The execution environment couldn't be started. Please try again.",
  );
  assert.equal(S.providerCalls.length, 0);
  assert.equal(S.audits.length, 0);
});

test('the model-turn budget is bounded and ends with the fallback message', async () => {
  reset();
  const session = makeSession();
  for (let i = 0; i < 20; i += 1) {
    S.providerResponses.push({
      type: 'command_request',
      content: 'aws ec2 describe-instances',
      command: 'aws ec2 describe-instances',
    });
    S.classifyResults.push(verdict({ verdict: POLICY_VERDICTS.ALLOW_READONLY }));
  }

  const { messages } = await handleUserMessage({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    userId: 'user-1',
    text: 'loop forever',
  });

  assert.equal(S.providerCalls.length, 8); // MAX_MODEL_TURNS_PER_MESSAGE
  assert.equal(S.execCalls.length, 8);
  const last = messages.at(-1);
  assert.equal(last.kind, 'TEXT');
  assert.match(last.content, /trouble completing this within the allotted steps/);
});

/* -------------------------------------------------------------------------- */
/* resolveProviderConfig (exercised through handleUserMessage)                 */
/* -------------------------------------------------------------------------- */

for (const [label, settings] of [
  ['no ChatSettings row', null],
  ['provider is null', { provider: null, providerApiKeyEncrypted: 'enc' }],
  ['API key is null', { provider: 'ANTHROPIC', providerApiKeyEncrypted: null }],
]) {
  test(`AI_PROVIDER_NOT_CONFIGURED when ${label}`, async () => {
    reset();
    const session = makeSession();
    S.settings = settings;

    await assert.rejects(
      () =>
        handleUserMessage({
          session,
          workspace: WORKSPACE,
          credential: CREDENTIAL,
          userId: 'user-1',
          text: 'hi',
        }),
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.code, ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED);
        return true;
      },
    );
    assert.equal(S.providerCalls.length, 0);
  });
}

/* -------------------------------------------------------------------------- */
/* confirmCommand                                                              */
/* -------------------------------------------------------------------------- */

test('confirmCommand executes the command, records the result and continues the loop', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];
  S.execResults = [{ stdout: 'remove_bucket: b', stderr: '', exitCode: 0, timedOut: false }];
  S.providerResponses = [{ type: 'text', content: 'Bucket deleted.' }];

  const { messages } = await confirmCommand({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    messageId: pending.id,
    userId: 'user-1',
  });

  assert.deepEqual(kinds(messages), [
    'ASSISTANT/COMMAND_REQUEST/EXECUTED',
    'ASSISTANT/COMMAND_RESULT/EXECUTED',
    'ASSISTANT/TEXT/null',
  ]);
  assert.equal(messages[1].content, 'remove_bucket: b');
  assert.equal(messages[1].commandOutput, 'remove_bucket: b');

  // The cap counter was consumed exactly once, atomically.
  assert.equal(S.sessionUpdateManyArgs.length, 1);
  assert.deepEqual(S.sessionUpdateManyArgs[0].where, {
    id: 'sess-1',
    mutatingCommandCount: { lt: 10 },
  });
  assert.deepEqual(S.sessionUpdateManyArgs[0].data, { mutatingCommandCount: { increment: 1 } });
  assert.equal(session.mutatingCommandCount, 1);

  // The claim was an updateMany gated on PENDING_CONFIRMATION.
  assert.deepEqual(S.messageUpdateManyArgs[0].where, {
    id: pending.id,
    sessionId: 'sess-1',
    status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
  });
  assert.deepEqual(S.messageUpdateManyArgs[0].data, { status: CHAT_MESSAGE_STATUS.CONFIRMED });

  assert.deepEqual(S.execCalls[0].argv, ['aws', 's3', 'rb', 's3://b']);
  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_EXECUTED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.SUCCESS);

  // The continuation conversation carries the proposal and its result once.
  const call = S.providerCalls[0];
  assert.deepEqual(call.history.at(-1), {
    role: 'assistant',
    content: '[proposed] aws s3 rb s3://b',
  });
  assert.equal(call.newMessage, 'Result:\nremove_bucket: b');
});

test('confirmCommand marks the message FAILED when the command exits non-zero', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];
  S.execResults = [{ stdout: '', stderr: 'AccessDenied', exitCode: 255, timedOut: false }];
  S.providerResponses = [{ type: 'text', content: 'That failed.' }];

  const { messages } = await confirmCommand({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    messageId: pending.id,
    userId: 'user-1',
  });

  assert.equal(messages[0].status, CHAT_MESSAGE_STATUS.FAILED);
  assert.equal(messages[1].status, CHAT_MESSAGE_STATUS.FAILED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.FAILURE);
});

test('confirmCommand: the double-confirm race loses atomically and never double-executes', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];
  S.execResults = [{ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false }];
  S.providerResponses = [{ type: 'text', content: 'done' }];

  await confirmCommand({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    messageId: pending.id,
    userId: 'user-1',
  });
  assert.equal(S.execCalls.length, 1);

  // Second confirm: the row is no longer PENDING_CONFIRMATION, so the claiming
  // updateMany matches zero rows.
  await assert.rejects(
    () =>
      confirmCommand({
        session,
        workspace: WORKSPACE,
        credential: CREDENTIAL,
        messageId: pending.id,
        userId: 'user-1',
      }),
    (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, ERROR_CODES.COMMAND_ALREADY_RESOLVED);
      return true;
    },
  );

  assert.equal(S.execCalls.length, 1, 'the losing confirm must not execute anything');
  assert.equal(session.mutatingCommandCount, 1, 'the counter must only move once');
});

test('confirmCommand: losing the cap race marks the message CAPPED and never executes', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      dryRunCapable: false,
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];
  S.capCounts = [0]; // a concurrent confirm took the last slot first

  const { messages } = await confirmCommand({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    messageId: pending.id,
    userId: 'user-1',
  });

  assert.deepEqual(kinds(messages), ['ASSISTANT/COMMAND_REQUEST/CAPPED', 'ASSISTANT/TEXT/null']);
  assert.match(messages[1].content, /reached its limit of 10 mutating commands/);
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 0);
  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.SESSION_CAP_EXCEEDED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.CAPPED);
});

test('confirmCommand: re-classification that is no longer confirmable FAILS without executing', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  S.classifyResults = [
    verdict({
      verdict: POLICY_VERDICTS.REJECTED,
      reason: 'Binary "aws" is not allowed in this mode',
      argv: ['aws', 's3', 'rb', 's3://b'],
    }),
  ];

  const { messages } = await confirmCommand({
    session,
    workspace: WORKSPACE,
    credential: CREDENTIAL,
    messageId: pending.id,
    userId: 'user-1',
  });

  assert.deepEqual(kinds(messages), ['ASSISTANT/COMMAND_REQUEST/FAILED', 'ASSISTANT/TEXT/null']);
  assert.equal(
    messages[1].content,
    'This command can no longer be run: Binary "aws" is not allowed in this mode.',
  );
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.providerCalls.length, 0);
  assert.equal(S.sessionUpdateManyArgs.length, 0, 'the counter must not be incremented');
  assert.equal(session.mutatingCommandCount, 0);
  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_REJECTED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.FAILURE);

  // Re-classification reads the persisted command text, not a model string.
  assert.equal(S.classifyCalls[0].commandString, 'aws s3 rb s3://b');
});

test('confirmCommand: an unknown or already-resolved message id is a 409', async () => {
  reset();
  const session = makeSession();

  await assert.rejects(
    () =>
      confirmCommand({
        session,
        workspace: WORKSPACE,
        credential: CREDENTIAL,
        messageId: 'nope',
        userId: 'user-1',
      }),
    (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, ERROR_CODES.COMMAND_ALREADY_RESOLVED);
      return true;
    },
  );
  assert.equal(S.execCalls.length, 0);
});

/* -------------------------------------------------------------------------- */
/* cancelCommand                                                               */
/* -------------------------------------------------------------------------- */

test('cancelCommand updates the status, acknowledges, and touches nothing else', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  const { messages } = await cancelCommand({
    session,
    workspace: WORKSPACE,
    messageId: pending.id,
    userId: 'user-1',
  });

  assert.deepEqual(kinds(messages), ['ASSISTANT/COMMAND_REQUEST/CANCELLED', 'ASSISTANT/TEXT/null']);
  assert.equal(messages[1].content, 'Command cancelled.');

  assert.equal(S.providerCalls.length, 0);
  assert.equal(S.execCalls.length, 0);
  assert.equal(S.provisionCalls.length, 0);
  assert.equal(S.sessionUpdateManyArgs.length, 0);
  assert.equal(session.mutatingCommandCount, 0);

  assert.equal(S.audits.length, 1);
  assert.equal(S.audits[0].action, AUDIT_ACTIONS.COMMAND_CANCELLED);
  assert.equal(S.audits[0].outcome, AUDIT_OUTCOMES.CANCELLED);
  assert.deepEqual(S.audits[0].metadata, { messageId: pending.id });
  assert.equal(S.audits[0].workspaceId, 'ws-1');
});

test('cancelCommand without a workspace argument still audits against the session workspace', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');

  await cancelCommand({ session, messageId: pending.id, userId: 'user-1' });

  assert.equal(S.audits[0].workspaceId, 'ws-1');
});

test('cancelCommand on an already-resolved command is a 409 and writes nothing', async () => {
  reset();
  const session = makeSession();
  const pending = seedPendingCommand('sess-1', 'aws s3 rb s3://b');
  pending.status = CHAT_MESSAGE_STATUS.CANCELLED;

  await assert.rejects(
    () => cancelCommand({ session, workspace: WORKSPACE, messageId: pending.id, userId: 'user-1' }),
    (err) => {
      assert.equal(err.status, 409);
      assert.equal(err.code, ERROR_CODES.COMMAND_ALREADY_RESOLVED);
      return true;
    },
  );
  assert.equal(S.created.length, 0);
  assert.equal(S.audits.length, 0);
});
