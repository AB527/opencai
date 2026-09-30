// Deterministic, pure, synchronous command policy classifier.
//
// This decides whether a command an LLM proposed may run immediately, may run
// only after an explicit human confirmation, or must never run at all. It does
// no I/O and has no state -- given the same inputs it always returns the same
// verdict. Every unknown is denied: there is no code path here that allows a
// command the rules do not positively recognise as safe.
const { parse } = require('shell-quote');

const { POLICY_VERDICTS } = require('./policyVerdicts');
const {
  READONLY_PREFIXES,
  MUTATING_PREFIXES,
  MUTATING_EXACT_OPERATIONS,
  DRY_RUN_SUPPORTED_EC2_OPERATIONS,
} = require('./patterns/aws');

function reject(reason, argv = [], binary = null) {
  return {
    verdict: POLICY_VERDICTS.REJECTED,
    reason,
    dryRunCapable: false,
    argv,
    binary,
    verb: null,
  };
}

function startsWithAny(operation, prefixes) {
  return prefixes.some((prefix) => operation.startsWith(prefix));
}

/**
 * Classify a proposed shell command.
 *
 * `mode` / `subMode` are accepted for logging and future extensibility; they do
 * not influence classification today. The only persona-derived input that
 * matters here is `personaAllowedBinaries`, already resolved by the caller.
 *
 * @returns {{ verdict: string, reason: string|null, dryRunCapable: boolean,
 *             argv: string[], binary: string|null, verb: string|null }}
 */
function classify({ mode, subMode, commandString, personaAllowedBinaries }) {
  void mode;
  void subMode;

  // 1. Tokenize. Anything shell-quote cannot make sense of is rejected.
  if (typeof commandString !== 'string') {
    return reject('Command could not be parsed');
  }

  let tokens;
  try {
    tokens = parse(commandString);
  } catch {
    return reject('Command could not be parsed');
  }

  if (!Array.isArray(tokens)) {
    return reject('Command could not be parsed');
  }

  // 2. Reject shell metacharacters. shell-quote returns operator tokens
  //    (&&, ||, |, ;, >, <, globs, comments) as objects; ordinary arguments
  //    come back as plain strings. Any non-string token means the model tried
  //    to use shell syntax, which is never allowed.
  if (tokens.some((token) => typeof token !== 'string')) {
    return reject('Shell operators or metacharacters are not allowed');
  }

  const argv = tokens;

  // 3. Defense in depth. Every token is a plain string by now, but backticks
  //    and $( have no legitimate use in an AWS CLI argument. Rejecting them
  //    keeps this classifier safe even if some future caller ever hands the
  //    result to a real shell (today's sandbox execs argv directly).
  if (argv.some((token) => token.includes('`') || token.includes('$('))) {
    return reject('Command contains disallowed characters');
  }

  // 4. Empty command.
  if (argv.length === 0) {
    return reject('Empty command');
  }

  // 5. Binary allowlist.
  const binary = argv[0];
  const allowedBinaries = Array.isArray(personaAllowedBinaries) ? personaAllowedBinaries : [];
  if (!allowedBinaries.includes(binary)) {
    return reject(`Binary "${binary}" is not allowed in this mode`, argv, binary);
  }

  // 6. --help is always a lookup: the AWS CLI prints locally bundled usage
  //    text without touching the network or mutating anything, whatever verb
  //    it is attached to and whether or not that verb is recognised.
  if (argv.includes('--help')) {
    return {
      verdict: POLICY_VERDICTS.ALLOW_LOOKUP,
      reason: null,
      dryRunCapable: false,
      argv,
      binary,
      verb: argv[1] ?? null,
    };
  }

  // 6b. `help` is how AWS CLI v2 prints documentation (it rejects `--help`).
  //     It is a help request only as the final token directly after the
  //     binary, service or operation -- `aws help`, `aws ec2 help`,
  //     `aws ec2 describe-instances help` -- so only those exact shapes count.
  //     Anywhere else "help" is an ordinary argument and gets classified below.
  if (argv.length >= 2 && argv.length <= 4 && argv[argv.length - 1] === 'help') {
    return {
      verdict: POLICY_VERDICTS.ALLOW_LOOKUP,
      reason: null,
      dryRunCapable: false,
      argv,
      binary,
      verb: argv[1],
    };
  }

  // 7. Structure check: `aws <service> <operation> [args...]`.
  if (argv.length < 3) {
    return reject('Command is missing a service or operation', argv, binary);
  }

  // 8. Classify the operation. Mutating patterns are checked first so that an
  //    operation matching both lists is treated as the more dangerous one.
  const operation = argv[2];

  const isMutating =
    MUTATING_EXACT_OPERATIONS.includes(operation) || startsWithAny(operation, MUTATING_PREFIXES);

  if (isMutating) {
    // 10. Mutating path.
    const dryRunCapable = argv[1] === 'ec2' && DRY_RUN_SUPPORTED_EC2_OPERATIONS.includes(operation);
    return {
      verdict: POLICY_VERDICTS.REQUIRE_CONFIRMATION,
      reason: null,
      dryRunCapable,
      argv,
      binary,
      verb: operation,
    };
  }

  if (startsWithAny(operation, READONLY_PREFIXES)) {
    // 9. Read-only path.
    return {
      verdict: POLICY_VERDICTS.ALLOW_READONLY,
      reason: null,
      dryRunCapable: false,
      argv,
      binary,
      verb: operation,
    };
  }

  // Default-deny. Anything we do not positively recognise as read-only or
  // mutating is rejected -- never assumed safe. This is the single most
  // important line in this file.
  return reject(
    `Unrecognized operation "${operation}" -- neither a known read-only nor mutating pattern`,
    argv,
    binary,
  );
}

module.exports = { classify };
