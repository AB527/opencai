// Agent orchestrator: the integration point that drives PLAN.md's execution
// flow by wiring together the provider adapters, the persona/system-prompt
// service, the deterministic command policy classifier, the output sanitizer,
// the credential mapper and the Docker sandbox.
//
// Two rules from Task 5's security review are load-bearing here and are
// repeated at every call site below:
//
//   1. `classify()`'s `result.argv` -- not the model's raw `commandString` --
//      is authoritative for anything a human sees or that lands in the audit
//      log. `shell-quote` expands `$VAR` to empty and collapses newlines, so
//      the raw string an LLM emitted can differ from what would actually run.
//      Confirming the raw string would mean confirming something other than
//      what executes.
//   2. `argv` is only ever executed as an array. Nothing in this file builds a
//      shell string; `executeInSandbox` takes the array straight through to
//      Docker's `Cmd`, so no shell ever parses it.

const prisma = require('../config/db');
const envelope = require('../crypto/envelope');
const { AppError } = require('../middleware/errorHandler');
const { ERROR_CODES } = require('../constants/errors');
const { CHAT_MESSAGE_STATUS } = require('../constants/chatMessageStatus');
const { AUDIT_ACTIONS, AUDIT_OUTCOMES } = require('../constants/auditActions');
const { MAX_MODEL_TURNS_PER_MESSAGE, MAX_ORCHESTRATION_WALL_CLOCK_MS } = require('./constants');
const { getProvider } = require('./providers');
const { getPersona } = require('./systemPrompt.service');
const { classify } = require('./policy/commandPolicy');
const { POLICY_VERDICTS } = require('./policy/policyVerdicts');
const { sanitizeOutput } = require('./sanitizer');
const { credentialToEnv } = require('./credentials');
const { provisionSandbox, executeInSandbox } = require('./sandbox/sandboxManager');

// How many prior ChatMessage rows are replayed into the model's context.
// Deliberately local: nothing outside this orchestrator has an opinion on it.
const MAX_HISTORY_MESSAGES = 40;

// ChatMessageRole / ChatMessageKind values, as plain strings. `SYSTEM` is
// deliberately absent: the system prompt is passed to the provider directly and
// is never persisted as a chat row.
const ROLE = Object.freeze({ USER: 'USER', ASSISTANT: 'ASSISTANT' });
const KIND = Object.freeze({
  TEXT: 'TEXT',
  LOOKUP_REQUEST: 'LOOKUP_REQUEST',
  COMMAND_REQUEST: 'COMMAND_REQUEST',
  COMMAND_RESULT: 'COMMAND_RESULT',
});

const SANDBOX_UNAVAILABLE_TEXT = "The execution environment couldn't be started. Please try again.";
const BUDGET_EXHAUSTED_TEXT =
  "I'm having trouble completing this within the allotted steps. Please try rephrasing or breaking your request into smaller steps.";
const DRY_RUN_FAILED_TEXT = '(dry-run failed to execute)';

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the singleton ChatSettings row into everything one orchestration turn
 * needs from it: a live provider module, the model/API key, and the sandbox
 * timeouts.
 */
async function resolveProviderConfig() {
  const settings = await prisma.chatSettings.findFirst();
  if (!settings || !settings.provider || !settings.providerApiKeyEncrypted) {
    throw new AppError(503, ERROR_CODES.AI_PROVIDER_NOT_CONFIGURED);
  }

  const apiKey = envelope.decrypt(settings.providerApiKeyEncrypted);
  const provider = getProvider(settings.provider);

  return {
    provider,
    model: settings.model,
    apiKey,
    baseUrl: settings.baseUrl || undefined,
    config: settings.config || undefined,
    sandboxCommandTimeoutSeconds: settings.sandboxCommandTimeoutSeconds,
    sandboxIdleTimeoutMinutes: settings.sandboxIdleTimeoutMinutes,
  };
}

/**
 * Flatten persisted ChatMessage rows (oldest first) into the stateless
 * `{ role, content }` turns both provider adapters expect.
 *
 * Proposals and results are rendered as plain text rather than as native
 * tool-call/tool-result blocks. That is the deliberate simplification that lets
 * both adapters stay single-shot and stateless, with no provider-specific
 * tool-call replay format to maintain (see Task 3).
 */
function buildHistoryFromMessages(messages) {
  return messages.map((m) => {
    if (m.kind === KIND.LOOKUP_REQUEST || m.kind === KIND.COMMAND_REQUEST) {
      return { role: 'assistant', content: `[proposed] ${m.content}` };
    }
    if (m.kind === KIND.COMMAND_RESULT) {
      return { role: 'user', content: `Result:\n${m.content}` };
    }
    return { role: m.role === ROLE.USER ? 'user' : 'assistant', content: m.content };
  });
}

/**
 * Load the most recent MAX_HISTORY_MESSAGES rows for a session, oldest first.
 *
 * `excludeIds` keeps rows this turn has already created out of the replayed
 * history, so they are not counted twice against the rows the caller appends to
 * the conversation explicitly.
 *
 * Implementation note: fetched with `orderBy: desc` + `take` + `reverse()`
 * rather than Prisma's negative-`take` idiom. Both are documented to return the
 * last N; this form is unambiguous without a live database to verify against.
 */
async function loadPriorHistory(sessionId, excludeIds = []) {
  const ids = excludeIds.filter(Boolean);
  const rows = await prisma.chatMessage.findMany({
    where: ids.length > 0 ? { sessionId, id: { notIn: ids } } : { sessionId },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  });
  return buildHistoryFromMessages([...rows].reverse());
}

/**
 * Write one AuditLog row. `session.userId` is the authoritative actor (the
 * session's owning Operator); ownership is already checked by the caller.
 */
async function writeAudit({ session, workspace, action, outcome, metadata }) {
  await prisma.auditLog.create({
    data: {
      actorUserId: session.userId,
      workspaceId: workspace?.id ?? session.workspaceId ?? null,
      chatSessionId: session.id,
      action,
      outcome: outcome ?? null,
      metadata,
    },
  });
}

async function createMessage(createdMessages, data) {
  const row = await prisma.chatMessage.create({ data });
  createdMessages.push(row);
  return row;
}

function createAssistantText(createdMessages, sessionId, content) {
  return createMessage(createdMessages, {
    sessionId,
    role: ROLE.ASSISTANT,
    kind: KIND.TEXT,
    content,
  });
}

/** Sanitize both streams independently and join them into one output blob. */
function combineOutput(execution) {
  const out = sanitizeOutput(execution?.stdout ?? '');
  const err = execution?.stderr ? sanitizeOutput(execution.stderr) : '';
  return err ? `${out}\n${err}` : out;
}

/**
 * The single source of the command text this orchestrator persists and audits.
 *
 * Always the classifier's tokenized argv -- never the model's raw string. The
 * raw string is used only when argv came back empty, which only happens on a
 * REJECTED verdict for genuinely unparseable input that will never execute.
 */
function commandTextFor(result, rawCommand) {
  if (Array.isArray(result.argv) && result.argv.length > 0) {
    return result.argv.join(' ');
  }
  return typeof rawCommand === 'string' ? rawCommand : '';
}

function hasExplanation(providerResult) {
  return (
    typeof providerResult.explanation === 'string' && providerResult.explanation.trim().length > 0
  );
}

function cappedText(cap) {
  return `This session has reached its limit of ${cap} mutating commands. Start a new session to continue.`;
}

/* -------------------------------------------------------------------------- */
/* The model loop                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Drive the provider until it produces a terminal state for this turn.
 *
 * Terminal states: a plain text answer, a rejected proposal, a capped proposal,
 * or a mutating command parked awaiting confirmation. Lookups and read-only
 * commands execute immediately and feed their result back for another turn,
 * bounded by MAX_MODEL_TURNS_PER_MESSAGE and MAX_ORCHESTRATION_WALL_CLOCK_MS.
 *
 * `conversation` grows in place; its last entry is always the trigger for the
 * next provider call. `createdMessages` accumulates every persisted row, in
 * order, and becomes the caller's `{ messages }`.
 */
async function runModelLoop({
  session,
  persona,
  providerConfig,
  workspace,
  env,
  containerId,
  conversation,
  createdMessages,
  startedAt,
}) {
  for (let turn = 0; turn < MAX_MODEL_TURNS_PER_MESSAGE; turn += 1) {
    if (Date.now() - startedAt >= MAX_ORCHESTRATION_WALL_CLOCK_MS) break;

    const history = conversation.slice(0, -1);
    const newMessage = conversation[conversation.length - 1].content;

    const providerResult = await providerConfig.provider.sendMessage({
      systemPrompt: persona.systemPrompt,
      history,
      newMessage,
      model: providerConfig.model,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
      config: providerConfig.config,
    });

    // 1. Plain answer -- the model is done with this turn.
    if (providerResult.type === 'text') {
      await createAssistantText(createdMessages, session.id, providerResult.content);
      return;
    }

    const isLookup = providerResult.type === 'lookup_request';
    const kind = isLookup ? KIND.LOOKUP_REQUEST : KIND.COMMAND_REQUEST;

    const result = classify({
      mode: session.mode,
      subMode: session.subMode,
      commandString: providerResult.command,
      personaAllowedBinaries: persona.allowedBinaries,
    });

    // An explanation is its own ASSISTANT/TEXT row, persisted *before* the
    // request row -- never folded into the request row's content, which must
    // round-trip the command string exactly for re-classification at confirm.
    if (hasExplanation(providerResult)) {
      await createAssistantText(createdMessages, session.id, providerResult.explanation);
    }

    const commandText = commandTextFor(result, providerResult.command);

    // 2. Rejected by policy -- never executes.
    if (result.verdict === POLICY_VERDICTS.REJECTED) {
      await createMessage(createdMessages, {
        sessionId: session.id,
        role: ROLE.ASSISTANT,
        kind,
        content: commandText,
        status: CHAT_MESSAGE_STATUS.REJECTED,
      });
      await writeAudit({
        session,
        workspace,
        action: AUDIT_ACTIONS.COMMAND_REJECTED,
        outcome: AUDIT_OUTCOMES.REJECTED,
        metadata: { command: result.argv, reason: result.reason },
      });
      await createAssistantText(createdMessages, session.id, `I can't run that: ${result.reason}`);
      return;
    }

    // 3. Lookup or read-only -- safe to run without a human in the loop.
    if (
      result.verdict === POLICY_VERDICTS.ALLOW_LOOKUP ||
      result.verdict === POLICY_VERDICTS.ALLOW_READONLY
    ) {
      const execution = await executeInSandbox(containerId, result.argv, {
        env,
        timeoutSeconds: providerConfig.sandboxCommandTimeoutSeconds,
      });
      const output = combineOutput(execution);

      await createMessage(createdMessages, {
        sessionId: session.id,
        role: ROLE.ASSISTANT,
        kind,
        content: commandText,
        status: CHAT_MESSAGE_STATUS.EXECUTED,
      });
      await createMessage(createdMessages, {
        sessionId: session.id,
        role: ROLE.ASSISTANT,
        kind: KIND.COMMAND_RESULT,
        content: output,
        commandOutput: output,
        status: CHAT_MESSAGE_STATUS.EXECUTED,
      });

      await writeAudit({
        session,
        workspace,
        action: isLookup ? AUDIT_ACTIONS.LOOKUP_EXECUTED : AUDIT_ACTIONS.COMMAND_EXECUTED,
        outcome: execution.exitCode === 0 ? AUDIT_OUTCOMES.SUCCESS : AUDIT_OUTCOMES.FAILURE,
        metadata: {
          command: result.argv,
          exitCode: execution.exitCode,
          timedOut: execution.timedOut,
        },
      });

      conversation.push({ role: 'assistant', content: `[proposed] ${commandText}` });
      conversation.push({ role: 'user', content: `Result:\n${output}` });
      continue;
    }

    // 4. Mutating -- gated behind an explicit human confirmation.
    if (session.mutatingCommandCount >= session.mutatingCommandCap) {
      await createMessage(createdMessages, {
        sessionId: session.id,
        role: ROLE.ASSISTANT,
        kind,
        content: commandText,
        status: CHAT_MESSAGE_STATUS.CAPPED,
      });
      await writeAudit({
        session,
        workspace,
        action: AUDIT_ACTIONS.SESSION_CAP_EXCEEDED,
        outcome: AUDIT_OUTCOMES.CAPPED,
        metadata: { command: result.argv },
      });
      await createAssistantText(
        createdMessages,
        session.id,
        cappedText(session.mutatingCommandCap),
      );
      return;
    }

    await createMessage(createdMessages, {
      sessionId: session.id,
      role: ROLE.ASSISTANT,
      kind,
      content: commandText,
      status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
    });
    await writeAudit({
      session,
      workspace,
      action: AUDIT_ACTIONS.COMMAND_PROPOSED,
      outcome: null,
      metadata: { command: result.argv },
    });

    // Best-effort preview. A dry-run that blows up must not block the
    // confirmation flow, so the Operator still gets a result row either way.
    if (result.dryRunCapable && !result.argv.includes('--dry-run')) {
      let dryRunOutput;
      try {
        const dryRun = await executeInSandbox(containerId, [...result.argv, '--dry-run'], {
          env,
          timeoutSeconds: providerConfig.sandboxCommandTimeoutSeconds,
        });
        dryRunOutput = combineOutput(dryRun);
      } catch (err) {
        console.error(`[orchestrator] dry-run failed for session ${session.id}: ${err.message}`);
        dryRunOutput = DRY_RUN_FAILED_TEXT;
      }

      await createMessage(createdMessages, {
        sessionId: session.id,
        role: ROLE.ASSISTANT,
        kind: KIND.COMMAND_RESULT,
        content: dryRunOutput,
        commandOutput: dryRunOutput,
        status: CHAT_MESSAGE_STATUS.DRY_RUN,
      });
    }

    // The proposal/confirm split: this turn ends here and confirmCommand picks
    // the conversation back up.
    return;
  }

  // Fell out of the loop without reaching a terminal state.
  await createAssistantText(createdMessages, session.id, BUDGET_EXHAUSTED_TEXT);
}

/* -------------------------------------------------------------------------- */
/* Entry points                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Handle one Operator chat message end to end.
 *
 * @param {{ session: object, workspace: object, credential: object,
 *           userId: string, text: string }} params
 * @returns {Promise<{ messages: object[] }>} every row persisted, in order.
 */
async function handleUserMessage({ session, workspace, credential, userId, text }) {
  // Accepted for future audit/authorization use; `session.userId` is the
  // authoritative actor for the audit writes below.
  void userId;

  const startedAt = Date.now();
  const createdMessages = [];

  const userMessage = await createMessage(createdMessages, {
    sessionId: session.id,
    role: ROLE.USER,
    kind: KIND.TEXT,
    content: text,
  });

  // Deliberately allowed to propagate: the HTTP layer turns AppErrors into
  // responses.
  const providerConfig = await resolveProviderConfig();
  const persona = await getPersona(session.mode, session.subMode);

  let containerId;
  try {
    ({ containerId } = await provisionSandbox(session, {
      idleTimeoutMinutes: providerConfig.sandboxIdleTimeoutMinutes,
    }));
  } catch (err) {
    console.error(
      `[orchestrator] sandbox provisioning failed for session ${session.id}: ${err.message}`,
    );
    // Nothing was proposed, so nothing to audit -- just tell the Operator.
    await createAssistantText(createdMessages, session.id, SANDBOX_UNAVAILABLE_TEXT);
    return { messages: createdMessages };
  }

  const env = credentialToEnv(workspace.csp, credential);

  // The row created above is excluded and re-appended explicitly, so it is
  // neither double-counted nor ordered by a createdAt tie.
  const priorHistory = await loadPriorHistory(session.id, [userMessage.id]);
  const conversation = [...priorHistory, { role: 'user', content: text }];

  await runModelLoop({
    session,
    persona,
    providerConfig,
    workspace,
    env,
    containerId,
    conversation,
    createdMessages,
    startedAt,
  });

  return { messages: createdMessages };
}

/**
 * Execute a command the Operator explicitly confirmed, then let the model
 * continue from its result.
 *
 * @param {{ session: object, workspace: object, credential: object,
 *           messageId: string, userId: string }} params
 * @returns {Promise<{ messages: object[] }>}
 */
async function confirmCommand({ session, workspace, credential, messageId, userId }) {
  void userId;

  const startedAt = Date.now();
  const createdMessages = [];

  // Atomic claim. Two concurrent confirms both issue this UPDATE; exactly one
  // matches a row still in PENDING_CONFIRMATION, so exactly one can go on to
  // execute. A read-then-write here would let both pass the check.
  const claimed = await prisma.chatMessage.updateMany({
    where: {
      id: messageId,
      sessionId: session.id,
      status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
    },
    data: { status: CHAT_MESSAGE_STATUS.CONFIRMED },
  });
  if (claimed.count !== 1) {
    throw new AppError(409, ERROR_CODES.COMMAND_ALREADY_RESOLVED);
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  const persona = await getPersona(session.mode, session.subMode);

  // Defense in depth: policy, persona binaries or mode could have changed
  // between proposal and confirmation. Re-classify the persisted command text
  // and refuse anything that is no longer exactly a confirmable mutation.
  const result = classify({
    mode: session.mode,
    subMode: session.subMode,
    commandString: message.content,
    personaAllowedBinaries: persona.allowedBinaries,
  });

  if (result.verdict !== POLICY_VERDICTS.REQUIRE_CONFIRMATION) {
    const failed = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { status: CHAT_MESSAGE_STATUS.FAILED },
    });
    createdMessages.push(failed);

    await createAssistantText(
      createdMessages,
      session.id,
      `This command can no longer be run: ${result.reason || 'it is no longer permitted'}.`,
    );
    await writeAudit({
      session,
      workspace,
      action: AUDIT_ACTIONS.COMMAND_REJECTED,
      outcome: AUDIT_OUTCOMES.FAILURE,
      metadata: { command: result.argv, reason: result.reason },
    });

    // No execution, and the mutating counter is untouched.
    return { messages: createdMessages };
  }

  // Resolved before the counter is consumed, so a misconfigured provider cannot
  // burn a slot off the session's mutating budget.
  const providerConfig = await resolveProviderConfig();

  // Atomic cap increment. The `lt` predicate and the increment are one
  // statement, so concurrent confirms can never push the count past the cap:
  // the losing UPDATE matches zero rows.
  const capResult = await prisma.chatSession.updateMany({
    where: { id: session.id, mutatingCommandCount: { lt: session.mutatingCommandCap } },
    data: { mutatingCommandCount: { increment: 1 } },
  });
  if (capResult.count !== 1) {
    const capped = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { status: CHAT_MESSAGE_STATUS.CAPPED },
    });
    createdMessages.push(capped);

    await createAssistantText(createdMessages, session.id, cappedText(session.mutatingCommandCap));
    await writeAudit({
      session,
      workspace,
      action: AUDIT_ACTIONS.SESSION_CAP_EXCEEDED,
      outcome: AUDIT_OUTCOMES.CAPPED,
      metadata: { command: result.argv },
    });

    return { messages: createdMessages };
  }

  const { containerId } = await provisionSandbox(session, {
    idleTimeoutMinutes: providerConfig.sandboxIdleTimeoutMinutes,
  });
  const env = credentialToEnv(workspace.csp, credential);

  // argv, as an array. Never a shell string.
  const execution = await executeInSandbox(containerId, result.argv, {
    env,
    timeoutSeconds: providerConfig.sandboxCommandTimeoutSeconds,
  });
  const output = combineOutput(execution);
  const success = execution.exitCode === 0 && !execution.timedOut;
  const finalStatus = success ? CHAT_MESSAGE_STATUS.EXECUTED : CHAT_MESSAGE_STATUS.FAILED;

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: { status: finalStatus },
  });
  createdMessages.push(updated);

  const resultRow = await createMessage(createdMessages, {
    sessionId: session.id,
    role: ROLE.ASSISTANT,
    kind: KIND.COMMAND_RESULT,
    content: output,
    commandOutput: output,
    status: finalStatus,
  });

  await writeAudit({
    session,
    workspace,
    action: AUDIT_ACTIONS.COMMAND_EXECUTED,
    outcome: success ? AUDIT_OUTCOMES.SUCCESS : AUDIT_OUTCOMES.FAILURE,
    metadata: { command: result.argv, exitCode: execution.exitCode, timedOut: execution.timedOut },
  });

  // The proposal and its result are appended explicitly as the conversation's
  // trailing turns, so both are excluded from the replayed history.
  const priorHistory = await loadPriorHistory(session.id, [messageId, resultRow.id]);
  const conversation = [
    ...priorHistory,
    { role: 'assistant', content: `[proposed] ${commandTextFor(result, message.content)}` },
    { role: 'user', content: `Result:\n${output}` },
  ];

  await runModelLoop({
    session,
    persona,
    providerConfig,
    workspace,
    env,
    containerId,
    conversation,
    createdMessages,
    startedAt,
  });

  return { messages: createdMessages };
}

/**
 * Cancel a pending command. No model call, no execution, no counter change.
 *
 * @param {{ session: object, workspace?: object, messageId: string,
 *           userId: string }} params
 * @returns {Promise<{ messages: object[] }>}
 */
async function cancelCommand({ session, workspace, messageId, userId }) {
  void userId;

  const createdMessages = [];

  // Same atomic claim as confirmCommand: a cancel that races a confirm (or
  // another cancel) loses cleanly instead of overwriting a resolved state.
  const claimed = await prisma.chatMessage.updateMany({
    where: {
      id: messageId,
      sessionId: session.id,
      status: CHAT_MESSAGE_STATUS.PENDING_CONFIRMATION,
    },
    data: { status: CHAT_MESSAGE_STATUS.CANCELLED },
  });
  if (claimed.count !== 1) {
    throw new AppError(409, ERROR_CODES.COMMAND_ALREADY_RESOLVED);
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  createdMessages.push(message);

  await createAssistantText(createdMessages, session.id, 'Command cancelled.');

  await writeAudit({
    session,
    workspace,
    action: AUDIT_ACTIONS.COMMAND_CANCELLED,
    outcome: AUDIT_OUTCOMES.CANCELLED,
    metadata: { messageId },
  });

  return { messages: createdMessages };
}

module.exports = { handleUserMessage, confirmCommand, cancelCommand };
