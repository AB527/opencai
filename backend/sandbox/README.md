# Sandbox image

Every AI-proposed command runs inside a container built from the `Dockerfile` in
this directory. The image is **not** pulled from a registry and is **not** built
automatically — an operator must build it locally before any chat session can
provision a sandbox.

## Build (required prerequisite)

From the repository root:

```sh
docker build -t opencai-sandbox:2.15.30 backend/sandbox
```

The tag must match `SANDBOX_IMAGE_TAG` in `backend/src/ai/constants.js` exactly.

If the image has not been built, `provisionSandbox()` fails loudly with a
"no such image" error from the Docker daemon. That is deliberate: the tag is a
purely local name that cannot resolve against any upstream registry, so a
missing build can never silently fall back to the unhardened upstream
`public.ecr.aws/aws-cli/aws-cli` image (which runs as root).

Automating this build as part of deployment is Phase 7's concern.

## What the image provides

- AWS CLI v2.15.30 and nothing else — this is a binary allowlist, not a
  general-purpose shell environment. Do not add tools here.
- A non-root `sandbox` user (uid 10001). The container is additionally pinned to
  `10001:10001` at the Docker API level by `sandboxManager.js`.
- A long-lived `sleep infinity` process, so one container serves repeated
  `docker exec` calls for the lifetime of a chat session.

Runtime hardening (read-only rootfs, dropped capabilities, `no-new-privileges`,
memory/CPU/PID limits, bridge networking) is applied by
`backend/src/ai/sandbox/sandboxManager.js`, not by this Dockerfile.

## Verifying a build

```sh
docker build -t opencai-sandbox:2.15.30 backend/sandbox
id=$(docker run -d opencai-sandbox:2.15.30)
docker exec "$id" whoami        # must NOT print root
docker exec "$id" aws --version
docker exec "$id" timeout --version   # executeInSandbox depends on this binary
docker rm -f "$id"
```
