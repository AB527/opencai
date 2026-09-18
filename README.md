# OpenCAI

OpenCAI is a white-labelled FinOps/AIOps platform: Administrators manage client Organisations,
Workspaces (Cloud Service Provider + Account + Environment), and Operator accounts; Operators use a
natural-language chat interface to run cloud operations and cost-analysis commands scoped to a
selected Workspace. See [`PLAN.md`](./PLAN.md) for the full build spec and phase-by-phase status.

## Repo layout

```
opencai/
├── frontend/          # Vite + React app, own .env
├── backend/           # Node.js + Express app, own .env
├── docker-compose.yml # frontend + backend + postgres + minio, for packaged/prod-like runs
├── dev.sh             # starts backend + frontend on host, nothing else
├── PLAN.md
└── README.md
```

## Prerequisites

- Node.js 24+
- A running Postgres instance and an S3-compatible object store (e.g. MinIO) that you provision
  and manage yourself. This repo's dev tooling never creates, starts, or manages either — it only
  connects to whatever `DATABASE_URL` / `S3_*` env vars point at.

## Local development

Each of `frontend/` and `backend/` needs its own `.env`, copied from that folder's `.env.example`
and filled in (in particular `backend/.env`'s `DATABASE_URL` and `S3_*` vars, pointing at your own
already-running Postgres and MinIO).

```
./dev.sh
```

This starts the backend (`nodemon`) and frontend (Vite dev server) on the host, prefixing their
log output with `[backend]` / `[frontend]`. Ctrl+C stops both. It does not touch Postgres, MinIO,
or any other infrastructure.

## Containerized run

A fully self-contained run — `docker compose` manages its own Postgres and MinIO, unlike `dev.sh`,
which expects both already running elsewhere.

Prerequisites:
- `backend/.env` and `frontend/.env`, each copied from their `.env.example` (as in local dev).
  `backend/.env`'s `DATABASE_URL`/`S3_*` values are overridden by `docker-compose.yml` to point at
  the compose network's own postgres/minio containers — only `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`,
  and `TOTP_ISSUER_NAME` need real values here.
- The AI agent sandbox image, built once on the host (not by this compose file):
  `docker build -t opencai-sandbox:2.15.30 backend/sandbox` (see `backend/sandbox/README.md`).

```sh
docker compose up --build -d
docker compose exec backend npm run prisma:seed   # first run only: seeds the master admin + personas
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:4000

`docker compose down` stops the stack and keeps its data (named volumes); add `-v` to also delete
the Postgres/MinIO data.

Note: the `backend` container mounts the host's Docker socket so the AI agent orchestrator can
provision sandbox containers as siblings on the host — this gives the backend container
host-level Docker control, a deliberate trade-off for how the sandboxed command execution in
Phase 6 works (see PLAN.md's Guardrails section).
