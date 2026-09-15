const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const Module = require('node:module');

// Stub the two side-effectful dependencies before sandboxManager loads them, so
// this suite needs neither a Docker daemon nor a database. `docker.modem` is a
// REAL dockerode modem, so demuxStream under test is the real implementation.
const Docker = require('dockerode');
const realModem = new Docker().modem;

const dockerCalls = { created: null, removed: [], execArgs: null };
let fakeExecBehaviour = null;
let fakeStreamFactory = null;

const fakeDocker = {
  modem: realModem,
  getContainer(id) {
    return {
      id,
      async inspect() {
        return { State: { Running: true } };
      },
      async exec(opts) {
        dockerCalls.execArgs = opts;
        return {
          async start() {
            return fakeStreamFactory();
          },
          async inspect() {
            return fakeExecBehaviour();
          },
        };
      },
      async stop() {},
      async remove(opts) {
        dockerCalls.removed.push({ id, opts });
      },
    };
  },
  async createContainer(config) {
    dockerCalls.created = config;
    return {
      id: 'container-abc',
      async start() {},
      async remove(opts) {
        dockerCalls.removed.push({ id: 'container-abc', opts });
      },
    };
  },
};

const prismaUpdates = [];
const fakePrisma = {
  chatSession: {
    async update(args) {
      prismaUpdates.push(args);
      if (fakePrisma.__failUpdate) throw new Error('db write failed');
      return {};
    },
    async findMany() {
      return [];
    },
  },
};

function inject(request, exports) {
  const resolved = require.resolve(request);
  require.cache[resolved] = new Module(resolved, null);
  require.cache[resolved].filename = resolved;
  require.cache[resolved].loaded = true;
  require.cache[resolved].exports = exports;
}

inject('./dockerClient', { docker: fakeDocker });
inject('../../config/db', fakePrisma);

const { provisionSandbox, executeInSandbox } = require('./sandboxManager');
const { SANDBOX_IMAGE_TAG } = require('../constants');

/** Build a Docker multiplexed frame: 1 = stdout, 2 = stderr. */
function frame(type, text) {
  const payload = Buffer.from(text, 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt8(type, 0);
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

function streamOf(...buffers) {
  return () => Readable.from(buffers);
}

function exitsWith(code) {
  return () => ({ Running: false, ExitCode: code });
}

test('demuxes stdout/stderr and returns the exit code', async () => {
  fakeStreamFactory = streamOf(frame(1, 'hello\n'), frame(2, 'oops\n'));
  fakeExecBehaviour = exitsWith(0);

  const result = await executeInSandbox('cid', ['aws', 'sts', 'get-caller-identity'], {
    env: { AWS_ACCESS_KEY_ID: 'AKIA', AWS_SECRET_ACCESS_KEY: 'shh' },
    timeoutSeconds: 30,
  });

  assert.deepEqual(result, {
    stdout: 'hello\n',
    stderr: 'oops\n',
    exitCode: 0,
    timedOut: false,
  });
});

test('passes argv as an array with the timeout wrapper, never a shell string', async () => {
  fakeStreamFactory = streamOf(frame(1, ''));
  fakeExecBehaviour = exitsWith(0);

  await executeInSandbox('cid', ['aws', 's3', 'ls', 's3://a b; rm -rf /'], {
    env: {},
    timeoutSeconds: 15,
  });

  assert.ok(Array.isArray(dockerCalls.execArgs.Cmd));
  assert.deepEqual(dockerCalls.execArgs.Cmd, [
    'timeout',
    '--signal=KILL',
    '15',
    'aws',
    's3',
    'ls',
    's3://a b; rm -rf /',
  ]);
  // No shell interpreter anywhere in the argv.
  assert.ok(!dockerCalls.execArgs.Cmd.some((a) => ['sh', 'bash', '-c'].includes(a)));
});

test('converts the env object to dockerode Env array form, per exec', async () => {
  fakeStreamFactory = streamOf(frame(1, ''));
  fakeExecBehaviour = exitsWith(0);

  await executeInSandbox('cid', ['aws', '--version'], {
    env: { AWS_ACCESS_KEY_ID: 'AKIA', AWS_SECRET_ACCESS_KEY: 'shh' },
    timeoutSeconds: 5,
  });

  assert.deepEqual(dockerCalls.execArgs.Env, [
    'AWS_ACCESS_KEY_ID=AKIA',
    'AWS_SECRET_ACCESS_KEY=shh',
  ]);
});

test('reports timedOut for exit code 124', async () => {
  fakeStreamFactory = streamOf(frame(1, 'partial'));
  fakeExecBehaviour = exitsWith(124);

  const result = await executeInSandbox('cid', ['aws', 'ec2', 'describe-instances'], {
    env: {},
    timeoutSeconds: 1,
  });

  assert.equal(result.exitCode, 124);
  assert.equal(result.timedOut, true);
});

test('does not report timedOut for a signal-killed exit code (137)', async () => {
  fakeStreamFactory = streamOf(frame(1, ''));
  fakeExecBehaviour = exitsWith(137);

  const result = await executeInSandbox('cid', ['aws', '--version'], {
    env: {},
    timeoutSeconds: 5,
  });

  assert.equal(result.exitCode, 137);
  assert.equal(result.timedOut, false);
});

test('fails closed when the exit code never resolves: timedOut, not success', async () => {
  fakeStreamFactory = streamOf(frame(1, 'output'));
  // Never stops running -> the bounded poll exhausts without an exit code.
  fakeExecBehaviour = () => ({ Running: true, ExitCode: null });

  const result = await executeInSandbox('cid', ['aws', '--version'], {
    env: {},
    timeoutSeconds: 5,
  });

  assert.equal(result.exitCode, null);
  assert.equal(result.timedOut, true, 'unresolved exec must be failure-shaped');
});

test('caps buffered output at 1MB and appends the truncation marker', async () => {
  const huge = 'x'.repeat(3 * 1024 * 1024);
  fakeStreamFactory = streamOf(frame(1, huge));
  fakeExecBehaviour = exitsWith(0);

  const result = await executeInSandbox('cid', ['aws', 's3api', 'list-objects'], {
    env: {},
    timeoutSeconds: 30,
  });

  const marker = '\n[... output truncated ...]';
  assert.ok(result.stdout.endsWith(marker));
  assert.equal(result.stdout.length, 1024 * 1024 + marker.length);
});

test('does not append the truncation marker to output under the cap', async () => {
  fakeStreamFactory = streamOf(frame(1, 'small output'));
  fakeExecBehaviour = exitsWith(0);

  const result = await executeInSandbox('cid', ['aws', '--version'], {
    env: {},
    timeoutSeconds: 30,
  });

  assert.equal(result.stdout, 'small output');
  assert.ok(!result.stdout.includes('truncated'));
});

test('truncates stdout and stderr independently', async () => {
  const huge = 'y'.repeat(2 * 1024 * 1024);
  fakeStreamFactory = streamOf(frame(1, 'tiny'), frame(2, huge));
  fakeExecBehaviour = exitsWith(1);

  const result = await executeInSandbox('cid', ['aws', '--version'], {
    env: {},
    timeoutSeconds: 30,
  });

  assert.equal(result.stdout, 'tiny');
  assert.ok(result.stderr.endsWith('\n[... output truncated ...]'));
});

test('rejects a non-array argv rather than spreading a string into characters', async () => {
  await assert.rejects(
    () => executeInSandbox('cid', 'aws --version', { env: {}, timeoutSeconds: 5 }),
    /non-empty argv array/,
  );
  await assert.rejects(() => executeInSandbox('cid', [], { env: {}, timeoutSeconds: 5 }), {
    message: 'executeInSandbox requires a non-empty argv array',
  });
});

test('createContainer pins a non-root user and the full hardening set', async () => {
  dockerCalls.created = null;
  prismaUpdates.length = 0;

  await provisionSandbox(
    { id: 'sess-1', sandboxContainerId: null, sandboxStatus: null },
    { idleTimeoutMinutes: 30 },
  );

  const cfg = dockerCalls.created;
  assert.equal(cfg.User, '10001:10001', 'must not run as root');
  assert.equal(cfg.Image, SANDBOX_IMAGE_TAG);
  assert.equal(cfg.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(cfg.HostConfig.CapDrop, ['ALL']);
  assert.deepEqual(cfg.HostConfig.SecurityOpt, ['no-new-privileges']);
  assert.ok(cfg.HostConfig.Memory > 0);
  assert.ok(cfg.HostConfig.NanoCpus > 0);
  assert.ok(cfg.HostConfig.PidsLimit > 0);
  assert.equal(cfg.HostConfig.NetworkMode, 'bridge');
  // Credentials must never be baked into the container.
  assert.equal(cfg.Env, undefined);
});

test('the sandbox image tag is a local tag, not an upstream-resolvable reference', () => {
  assert.equal(SANDBOX_IMAGE_TAG, 'opencai-sandbox:2.15.30');
  assert.ok(
    !SANDBOX_IMAGE_TAG.includes('/'),
    'a registry path could silently pull the unhardened upstream image',
  );
});

test('removes the container when it started but the row could not be persisted', async () => {
  dockerCalls.removed.length = 0;
  fakePrisma.__failUpdate = true;

  await assert.rejects(
    () =>
      provisionSandbox(
        { id: 'sess-2', sandboxContainerId: null, sandboxStatus: null },
        { idleTimeoutMinutes: 30 },
      ),
    /db write failed/,
    'the original error must not be masked by cleanup',
  );

  fakePrisma.__failUpdate = false;

  assert.ok(
    dockerCalls.removed.some((r) => r.id === 'container-abc' && r.opts.force === true),
    'an unpersisted container would otherwise leak forever',
  );
});

test('reuses a live container instead of creating a new one', async () => {
  dockerCalls.created = null;

  const result = await provisionSandbox(
    { id: 'sess-3', sandboxContainerId: 'existing-123', sandboxStatus: 'ready' },
    { idleTimeoutMinutes: 30 },
  );

  assert.equal(result.containerId, 'existing-123');
  assert.equal(dockerCalls.created, null, 'must not create when a live container exists');
});
