const { Writable } = require('node:stream');

const prisma = require('../../config/db');
const { docker } = require('./dockerClient');
const {
  SANDBOX_IMAGE_TAG,
  SANDBOX_DEFAULT_MEMORY_BYTES,
  SANDBOX_DEFAULT_NANO_CPUS,
  SANDBOX_DEFAULT_PIDS_LIMIT,
} = require('../constants');

// `sandboxStatus` is free-form internal bookkeeping, never shown to a user
// (unlike ChatMessage.status, which is UPPERCASE_SNAKE). Lowercase here.
const SANDBOX_STATUS = Object.freeze({
  READY: 'ready',
  DESTROYED: 'destroyed',
  ERROR: 'error',
});

// GNU coreutils `timeout` exits 124 when it had to kill the supervised command.
const TIMEOUT_EXIT_CODE = 124;

const IDLE_SWEEP_INTERVAL_MS = 60000;

/**
 * Collect everything written to it into an array of Buffers. Used instead of
 * PassThrough so demuxStream's synchronous `.write()` calls land in our buffer
 * before the source stream's 'end' fires -- no lost-tail race.
 */
function createCollector() {
  const chunks = [];
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  return { writable, chunks };
}

function expiryFrom(idleTimeoutMinutes) {
  return new Date(Date.now() + idleTimeoutMinutes * 60000);
}

/**
 * Ensure a live sandbox container exists for this chat session, reusing the
 * existing one when it is genuinely still running.
 *
 * @param {{ id: string, sandboxContainerId: ?string, sandboxStatus: ?string }} session
 * @param {{ idleTimeoutMinutes: number }} options
 * @returns {Promise<{ containerId: string }>}
 */
async function provisionSandbox(session, { idleTimeoutMinutes }) {
  if (session.sandboxContainerId && session.sandboxStatus === SANDBOX_STATUS.READY) {
    let stillRunning;
    try {
      const info = await docker.getContainer(session.sandboxContainerId).inspect();
      stillRunning = Boolean(info?.State?.Running);
    } catch {
      // Container is gone (Docker restarted, pruned, manually removed, ...).
      stillRunning = false;
    }

    if (stillRunning) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { sandboxExpiresAt: expiryFrom(idleTimeoutMinutes) },
      });
      return { containerId: session.sandboxContainerId };
    }
  }

  try {
    const container = await docker.createContainer({
      Image: SANDBOX_IMAGE_TAG,
      Cmd: ['sleep', 'infinity'],
      Entrypoint: [],
      Tty: false,
      HostConfig: {
        Memory: SANDBOX_DEFAULT_MEMORY_BYTES,
        NanoCpus: SANDBOX_DEFAULT_NANO_CPUS,
        PidsLimit: SANDBOX_DEFAULT_PIDS_LIMIT,
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: true,
        // ReadonlyRootfs makes every path unwritable, including the paths the
        // AWS CLI needs for its own scratch/config writes. Two small, capped,
        // noexec/nosuid tmpfs mounts keep the read-only root intact while
        // giving the CLI somewhere to write. Nothing here survives the
        // container, so this does not weaken the sandbox meaningfully.
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=64m',
          '/home/sandbox': 'rw,noexec,nosuid,size=64m',
        },
        NetworkMode: 'bridge',
        AutoRemove: false,
      },
    });
    await container.start();

    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        sandboxContainerId: container.id,
        sandboxStatus: SANDBOX_STATUS.READY,
        sandboxCreatedAt: new Date(),
        sandboxExpiresAt: expiryFrom(idleTimeoutMinutes),
      },
    });

    return { containerId: container.id };
  } catch (err) {
    // Best-effort status write -- must never mask the original failure.
    try {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { sandboxStatus: SANDBOX_STATUS.ERROR },
      });
    } catch (statusErr) {
      console.error(
        `[sandbox] failed to record error status for session ${session.id}: ${statusErr.message}`,
      );
    }
    throw err;
  }
}

/**
 * Run an already-tokenized argv inside an existing sandbox container.
 *
 * `argv` is passed straight through to Docker's `Cmd` as an array -- there is
 * no shell anywhere in this path, so no shell metacharacter can ever be
 * interpreted.
 *
 * @param {string} containerId
 * @param {string[]} argv Tokenized command, e.g. ['aws', 'ec2', 'describe-instances'].
 * @param {{ env: Record<string, string>, timeoutSeconds: number }} options
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: ?number, timedOut: boolean }>}
 */
async function executeInSandbox(containerId, argv, { env, timeoutSeconds }) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('executeInSandbox requires a non-empty argv array');
  }

  const container = docker.getContainer(containerId);
  const envArray = Object.entries(env ?? {}).map(([key, value]) => `${key}=${value}`);

  // Belt-and-braces: kill the process at the OS level inside the container,
  // independent of anything the Docker API does or does not enforce.
  const wrappedCmd = ['timeout', '--signal=KILL', String(timeoutSeconds), ...argv];

  const exec = await container.exec({
    Cmd: wrappedCmd,
    Env: envArray,
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const stdout = createCollector();
  const stderr = createCollector();

  await new Promise((resolve, reject) => {
    docker.modem.demuxStream(stream, stdout.writable, stderr.writable);
    stream.on('end', resolve);
    stream.on('close', resolve);
    stream.on('error', reject);
  });

  // The exec can still read as Running for a moment after the output stream
  // closes; poll briefly so ExitCode is populated rather than null.
  let exitCode = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const info = await exec.inspect();
    if (!info.Running && info.ExitCode !== null && info.ExitCode !== undefined) {
      exitCode = info.ExitCode;
      break;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  return {
    stdout: Buffer.concat(stdout.chunks).toString('utf8'),
    stderr: Buffer.concat(stderr.chunks).toString('utf8'),
    exitCode,
    timedOut: exitCode === TIMEOUT_EXIT_CODE,
  };
}

/**
 * Stop and remove a session's sandbox container. Safe to call repeatedly.
 * `sandboxContainerId` is deliberately retained for audit/debugging.
 *
 * @param {{ id: string, sandboxContainerId: ?string }} session
 * @returns {Promise<void>}
 */
async function destroySandbox(session) {
  if (session.sandboxContainerId) {
    const container = docker.getContainer(session.sandboxContainerId);
    try {
      await container.stop({ t: 5 });
    } catch {
      // Already stopped or already gone -- nothing worth surfacing.
    }
    try {
      await container.remove({ force: true });
    } catch {
      // Already removed -- nothing worth surfacing.
    }
  }

  await prisma.chatSession.update({
    where: { id: session.id },
    data: { sandboxStatus: SANDBOX_STATUS.DESTROYED },
  });
}

/**
 * Periodically reap sandboxes whose idle expiry has passed.
 *
 * Deliberately not `.unref()`ed: this timer needs to keep the process alive to
 * do its job.
 *
 * @returns {NodeJS.Timeout} the interval handle, so a caller can clearInterval it.
 */
function startIdleSweep() {
  return setInterval(async () => {
    try {
      const expired = await prisma.chatSession.findMany({
        where: {
          sandboxStatus: SANDBOX_STATUS.READY,
          sandboxExpiresAt: { lt: new Date() },
        },
      });

      if (expired.length === 0) return;

      const results = await Promise.allSettled(expired.map((s) => destroySandbox(s)));
      const reaped = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - reaped;
      console.log(
        `[sandbox] idle sweep reaped ${reaped} sandbox(es)${failed ? `, ${failed} failed` : ''}`,
      );
    } catch (err) {
      console.error(`[sandbox] idle sweep failed: ${err.message}`);
    }
  }, IDLE_SWEEP_INTERVAL_MS);
}

module.exports = { provisionSandbox, executeInSandbox, destroySandbox, startIdleSweep };
