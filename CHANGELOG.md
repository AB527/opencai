# 1.0.0 (2026-09-18)


### Bug Fixes

* **docker:** address final review findings (CORS, minio healthcheck, branding URLs, hardening, restart policy) ([f455363](https://github.com/AB527/opencai/commit/f4553630a8f72e9357705456a07198ddebf7989b))
* **release:** address final review findings (pin semantic-release version, tag-pinned Docker build, release process caveats) ([6dcdeab](https://github.com/AB527/opencai/commit/6dcdeab58aaa95f61598fdcaf772d822d054690f))


### Features

* **docker:** add backend Dockerfile, move prisma CLI to a runtime dependency ([a98f5cd](https://github.com/AB527/opencai/commit/a98f5cd8cf75105839dd0d28c9ed8be97a15c2ec))
* **docker:** add docker-compose.yml (postgres, minio, backend, frontend) ([0cb7216](https://github.com/AB527/opencai/commit/0cb72165c0e24e8e72c793323f40316c347000f7))
* **docker:** add frontend multi-stage Dockerfile (vite build + nginx) ([a1193b5](https://github.com/AB527/opencai/commit/a1193b529d839e766b92930bb1b086483f9c11de))
* **release:** add release.yml (semantic-release + GHCR image publish) ([a1ebb8d](https://github.com/AB527/opencai/commit/a1ebb8d6c245e488905ffb2db94e020b1545ef8d))
* **release:** add semantic-release config and version-bump script ([846855b](https://github.com/AB527/opencai/commit/846855b3ee5321290500b5497ed8f979db14e551))
