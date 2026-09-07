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
├── dev.sh             # starts backend + frontend on host, nothing else
├── PLAN.md
└── README.md
```

`docker-compose.yml` (a fully containerized run with Postgres + MinIO) arrives in a later build
phase (Phase 7 in `PLAN.md`) — it isn't present yet.

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

Not available yet — `docker-compose.yml` and the backend/frontend Dockerfiles are added in a later
phase. Once present, `docker compose up` will bring up the full stack (frontend, backend, postgres,
minio) for a packaged/prod-like run.
