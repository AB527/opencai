# OpenCAI — Build Plan

Drop this file in the root of the project folder, then tell Claude Code to execute it.

Postgres and MinIO (S3-compatible storage) will be arranged separately by me — do not add any script that creates, starts, or manages those containers for local dev. Assume both are already reachable at the connection details in `backend/.env`.

Use full, spelled-out terms throughout the UI and copy (e.g. "Organisation", not "Org"; "Administrator" is fine shortened to "Admin" since that's an established role name). Short forms are fine for genuinely technical abbreviations like CSP (Cloud Service Provider), ARN, IAM, etc.

## Repo layout

```
opencai/
├── frontend/          # Vite app, own .env
├── backend/           # Node.js app, own .env
├── docker-compose.yml # frontend + backend + postgres + minio, for packaged/prod-like runs
├── dev.sh             # starts backend + frontend on host, nothing else
├── PLAN.md
└── README.md
```

Each of `frontend/` and `backend/` keeps its own `.env` and `.env.example` — no shared root env file.

## Backend (Node.js, plain JS, Express, Prisma)

- Node.js + Express, plain JavaScript, no TypeScript, no build step.
- Postgres via Prisma. Prisma schema and migrations live in `backend/prisma/` (not `db/`).
- Object storage: an S3-compatible client (`@aws-sdk/client-s3` works fine against MinIO) for uploading and serving the company logo. Wrap it in `backend/src/storage/` with a simple `uploadFile` / `getFileUrl` helper, bucket name from env.

### `backend/src/modules/` layout

Every module folder contains its own `*.controller.js`, `*.service.js`, `*.route.js`. Modules stay isolated from each other — no cross-module imports, share data through Prisma models instead.

- `modules/open/` — public, unauthenticated endpoints. Contains the health check: `/healthz` (liveness) and `/readyz` (checks DB connectivity via Prisma).
- `modules/auth/` — login, JWT issuing, TOTP MFA enrollment/verification, backup codes, and change-password (requires old password + new password, available to both Admins and Operators).
- `modules/admin/` — admin-only actions:
  - **Manage Administrators** — add/remove Administrator accounts. The Administrator with username `admin` is the master admin and can never be deleted or demoted, regardless of who is logged in; enforce this in the service layer, not just the UI.
  - **Manage Operators** — create/list/update/deactivate Operator accounts, assign roles, and assign which Organisation(s) each Operator can access (populates their "Business" dropdown).
  - **Manage Chats** — read-only view over every chat conversation in the system (all Operators, all Administrators), for oversight/audit purposes. Backed by a `ChatMessage`/`ChatSession` table the chat module writes to.
  - **Manage Chat Settings** — model selection and related chat config, stored in a `ChatSettings` table.
  - **Manage Organisations** — a list of client Organisations. Selecting one opens its detail view: editable **Name**, **Address**, **Phone**, and — nested inside that same view — the list of **Workspaces** belonging to this Organisation. A Workspace is the tuple **Organisation → Cloud Service Provider (CSP) → Account → Environment**; from within an Organisation's detail view, Administrators add a Workspace by selecting a CSP and naming an Account and Environment, then attach credentials to it (e.g. AWS access key ID + secret access key, stored via the envelope-encryption helper — never plaintext). CSP is currently AWS-only; build the CSP field as a selectable enum/dropdown so adding a second provider later is just adding an option, not restructuring the model.
  - **Manage Branding** — this instance's own white-label branding, separate from any client Organisation: display name, logo, and the login page's left-panel image. All three uploads go through `backend/src/storage/` to the S3-compatible bucket; store the resulting object URL/key in an `InstanceBranding` table (a singleton row, not per-Organisation).
- `modules/chat/` — the natural-language chat interface that drives FinOps/AIOps commands, scoped to a selected Workspace. Persists every message to the chat history tables so `modules/admin`'s Manage Chats view can read it. Reads active model config from the `ChatSettings` table.
- `modules/operator/` — day-to-day actions scoped to the Operator role's permissions, and workspace-scoped data lookups (CSP/Account/Environment options within the Operator's Organisation) for populating the dashboard's workspace-selection dropdowns.

### Other backend structure

- `middleware/` — auth guard (JWT verification), RBAC role-check middleware, error handler, request validation.
- `constants/` — roles, error codes/messages, shared enums (MFA status, module names, CSP list — currently just `aws`).
- `crypto/` — envelope encryption helper for stored cloud credentials, AES-256-GCM with a data key wrapped by a master key from env. Encrypt/decrypt utilities with unit tests. Also encrypt the TOTP secret at rest with this helper.
- `config/` — env loading and validation at boot, fail fast if a required var is missing.

### Prisma models (baseline)

- `User` (role: admin | operator, username, hashed password, TOTP secret encrypted, backup codes hashed) — the seed/master admin has username `admin` and is protected from deletion at the service layer.
- `UserOrganisation` (join table: which Organisation(s) an Operator can access)
- `InstanceBranding` (singleton — this deployment's own display name, logo object key/URL, login-page image object key/URL)
- `Organisation` (name, address, phone — a client business managed by this instance)
- `Workspace` (belongs to an Organisation; CSP enum; account identifier; environment name)
- `WorkspaceCredential` (belongs to a Workspace; encrypted access key/secret, or equivalent per-CSP fields)
- `ChatSettings` (selected model, related config, likely a singleton row or versioned)
- `ChatSession` / `ChatMessage` (belongs to a User and a Workspace; full history for the Manage Chats admin view)
- `AuditLog`

### Auth / MFA / account flow

1. Username/password login.
2. If TOTP not yet enrolled: show QR enrollment screen (backend returns `otpauth://` URI + QR code as data URL from `otplib`/`speakeasy`), user scans into Google Authenticator, confirms with a code to complete enrollment.
3. If already enrolled: prompt for the 6-digit TOTP code as a second step before issuing the JWT.
4. Backup codes: one-time recovery codes generated at enrollment, hashed at rest, usable once each if the authenticator is lost.
5. On successful login (password + MFA), frontend redirects to the dashboard.
6. Change password (both roles): requires current password + new password, verified server-side before updating the hash.

`backend/.env.example` should cover: `DATABASE_URL`, `JWT_SECRET`, `MASTER_ENCRYPTION_KEY`, `PORT`, `NODE_ENV`, `TOTP_ISSUER_NAME`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`.

## Frontend (Vite + React, plain JS)

- Vite + React, plain JavaScript, no TypeScript.
- Pages: Login, MFA verification/enrollment (QR code + code entry), Dashboard (role-dependent), Profile.
- API client in `frontend/src/lib/api.js`, base URL from `VITE_API_BASE_URL`.
- `frontend/.env.example` with `VITE_API_BASE_URL`.
- Tailwind is fine for styling; this is scaffolding, not final UI polish.

## UI structure

### Login page

Use a split-screen layout:

- **Left panel**: a full-height image, rounded corners, with this instance's logo overlaid on it. This image is the **login page image** set from Manage Branding (falls back to a sensible default if none has been uploaded).
- **Right panel**: the sign-in card, centered:
  - A small pill badge in the top-left with OpenCAI's own tagline.
  - This instance's logo again, shown small in a card in the top-right of this panel.
  - A "Welcome back" heading with a short one-line subtext underneath.
  - Fields: **Username or Email**, **Password** (with a "Forgot password?" link aligned to the Password label), and a full-width **Sign in** button.
- After password is verified, this flow continues into TOTP verification (or enrollment, if first login) as described below, before reaching the dashboard.

### Top navigation bar (present on every authenticated screen)

- **Left**: this instance's logo (from Manage Branding; falls back to a default placeholder if none uploaded yet).
- **Right, two icons side by side**:
  - **Settings icon** — opens a small panel/menu containing a **Theme** setting: a short description of what it does, then a dropdown/select with three options — **Light**, **Dark**, **Device Default**. Persist the chosen value in `localStorage` and apply it on load (respect `Device Default` by following `prefers-color-scheme` when that option is selected).
  - **Profile icon** — opens the Profile view/dropdown, top to bottom:
    1. Profile image
    2. Name
    3. Role (Administrator / Operator)
    4. A list of actions: **Change Password**, **Logout** (add more here later as needed).

### Administrator dashboard

A landing screen presenting selectable sections (cards, tiles, or a side menu — pick whichever reads cleanest, but keep it simple):

- **Manage Administrators** — add/remove Administrators. The `admin` master account is visibly marked as protected and its delete action is disabled/hidden.
- **Manage Operators** — create/list/update/deactivate Operators.
- **Manage Chats** — browse chat history across all users; searchable/filterable by user and Workspace if straightforward to add, otherwise a simple chronological list is fine for scaffolding.
- **Manage Chat Settings** — model selection and related chat configuration.
- **Manage Organisations** — list of client Organisations; open one to edit its Name, Address, and Phone, and to manage its nested list of Workspaces (add/edit, including attaching CSP credentials). CSP dropdown currently offers only **AWS**.
- **Manage Branding** — edit this instance's own display name, upload/replace its logo, upload/replace the login page's left-panel image.

### Operator dashboard

A **left sidebar**, top to bottom:

1. **Two pill-style toggle buttons at the top: "Cloud" and "On-Prem".**
   - Selecting **On-Prem** replaces the rest of the sidebar content with a simple "Coming Soon" message.
   - Selecting **Cloud** (default) shows the rest of the sidebar as described below.
2. **Workspace summary card** (visible once a Workspace has been chosen) — a small 2x2 card labelled **"Choose your Workspace"** with an edit icon, showing the four resolved values as read-only labels: **Business** (the Organisation name), **Environment**, **Cloud Provider** (CSP), **Account / Subscription**. Clicking the edit icon reopens the full selector described below.
3. **Mode list** — below the workspace card, the two mode entries: **AIOps** and **FinOps** (icons + labels).
4. **Recent History** — below the mode list, the 5 most recent chat sessions, then a **"Show all →"** link (see below).

#### Workspace selection (first-time, inline in main content)

Before a Workspace is chosen, the main content area shows an inline **"Choose your Workspace"** card with a short instruction line and a 2x2 grid of dropdowns in this order: **Business** (a dropdown of the Organisations this Operator has access to), **Environment**, **Cloud Provider** (CSP — AWS-only for now), **Account / Subscription** (populated once CSP is chosen). Once all four are set, this card collapses into the sidebar summary card described above and the chat interface becomes active.

#### Session header

Above the chat area: the current session's ID shown as copyable text (small copy icon), and a **"New Session"** button that starts a fresh `ChatSession` for the current mode/sub-mode while keeping the same Workspace selection.

#### AIOps mode chat screen

Selecting **AIOps** opens an empty chat screen in the main content area:

- Header: **"Hi, I'm AIOps Agent ⚡"** with a short one-line description underneath (e.g. "I can help you with cloud operations including creating, updating, and deleting resources.").
- The workspace summary card (or the inline selector, if not yet chosen) sits between the header and the chat bar.
- Chat input bar below that.
- Below the chat bar: a row of **suggested-prompt pill buttons** — short example commands such as "Create an EC2 instance", "Start an EC2 instance", "Create EBS volume", "Create a new S3 bucket". Clicking a pill sends that text as the first chat message.

#### FinOps mode chat screen

Selecting **FinOps** shows a similar header ("Hi, I'm FinOps Agent 📊" + a one-line description), but structured the other way around:

- **Above** the chat bar (not below, unlike AIOps): a grid of **4 selectable sub-mode cards** under a **"Select Your FinOps Agent"** heading, each with an emoji above the title and a short description below the title:
  1. 🏷️ **Tag Compliance** — manage tags.
  2. 📊 **Cost Analytics** — analyze costs.
  3. ♻️ **Waste Management** — unused resources.
  4. 💰 **Cost Optimisation** — optimise spending.
- Selecting a sub-mode card highlights it, updates the header to reflect that sub-mode (e.g. "FinOps - Cost Analytics"), and reveals the chat bar below the cards with sub-mode-appropriate suggested pills (e.g. for Cost Analytics: "Show service-wise cost breakdown", "Report costs by tags for this month without credits", "Show me cost trend for last 14 days").

#### Recent history — full list

Below the 5 most recent sessions in the sidebar, the **"Show all →"** link opens a dedicated full-page **Chat History** view containing:

- A search bar at the top (search by keyword, and optionally filter by Workspace/mode/date if straightforward to add).
- The complete, paginated list of the Operator's past chat sessions below it, most recent first.

## How the AI performs operations (agent execution flow)

This is the core mechanism behind both AIOps and FinOps chat — spell this out clearly in the actual implementation, not just as a vague "call an LLM" step.

The model is **not** restricted to a fixed catalogue of pre-defined functions. Instead it operates the way a human operator would: it has access to a **shell** with the relevant CLI tools installed (`aws` CLI to start, more per-CSP tools as providers are added), and if it's unsure of the exact syntax for something, it can look it up (e.g. `aws <service> <command> --help`, or a curated local copy of CLI docs) before running the real command. Everything that makes this safe lives in the execution layer around the model, not in the model's own judgement — see Guardrails below.

1. **Context assembly.** When an Operator sends a chat message, the `chat` module resolves the full context: the selected Organisation, the selected Workspace (CSP + Account + Environment), the Mode (AIOps, or FinOps + which of the 4 sub-modes), and the conversation history for that chat session.

2. **Sandbox provisioning.** The backend spins up (or reuses, per-session) an isolated, ephemeral execution sandbox (a locked-down container — see Guardrails) for this chat session. The sandbox has the CLI tools installed but no credentials and no network access yet.

3. **Credential scoping.** The backend decrypts (via the envelope-encryption helper) only the `WorkspaceCredential` tied to the exact Account/Environment currently selected, and injects it into the sandbox as scoped environment variables/config — never into the LLM prompt itself, and never any broader than this one Workspace.

4. **Mode/sub-mode system prompt.** Selecting AIOps, or a specific FinOps sub-mode (Tag Compliance, Cost Analytics, Waste Management, Cost Optimisation), determines a distinct **system prompt ("persona")** for the LLM — its framing, tone, and scope of what it should and shouldn't attempt, plus the list of CLI tools available to it in this mode and the escalation rule (see Guardrails: destructive commands always pause for confirmation). Store these system prompts as data (a `mode`/`sub_mode` keyed table, editable later from Manage Chat Settings) rather than hardcoding them, so tuning a persona doesn't require a code change.

5. **Model call.** The backend sends: the resolved system prompt + the conversation history + the new user message, to whichever model is configured in `ChatSettings`. Wrap the provider call behind an abstraction in `backend/src/ai/` so swapping models/providers is a config change, not a rewrite.

6. **Model response — one of three shapes:**
   - Plain text: a clarifying question or an explanation, shown directly in the chat.
   - A **lookup request**: e.g. "run `aws s3api create-bucket --help`" — treated as a read-only, always-allowed action (see Guardrails), executed immediately, output fed straight back to the model so it can correct its next attempt.
   - A **command execution request**: the actual shell command it wants to run.

7. **Command policy check.** Every proposed command — lookup or execution — passes through a policy layer *before* it ever reaches the sandbox:
   - Is the binary being invoked on the allowlist for this mode? (Reject anything else outright.)
   - Does the command match a known read-only pattern (list/describe/get/`--dry-run`/`--help`) or a mutating one (create/put/delete/terminate/update/stop)?
   - Is a mutating command within this session's resource/spend guardrails (see below)?
   This check is deterministic code, not another model call — it doesn't rely on the LLM having classified its own command correctly.

8. **Confirmation gate.** Anything the policy layer classifies as mutating is **never auto-executed**. The chat shows the Operator the literal command about to run, in plain language, and requires an explicit "Confirm" before the backend executes it in the sandbox. Read-only and lookup commands run immediately without this step.

9. **Execution.** On confirmation (or immediately, for read-only/lookup commands), the backend runs the command inside the sandbox with the scoped credentials, captures stdout/stderr/exit code, and applies output sanitization (see Guardrails) before anything is stored or shown.

10. **Result relay.** The sanitized output is fed back to the model as the result of its command, and the model turns it into a natural-language summary for the Operator (e.g. "Your EC2 instance `i-0abc123` is now running in `us-east-1`."), or uses it to correct course and try a different command if the first one failed.

11. **Persistence.** Every step in the exchange — the Operator's input, each command proposed (lookup or execution), the confirm/cancel decision, the raw sanitized output, and the final natural-language response — is written to `ChatSession`/`ChatMessage` (for the admin Manage Chats view) and to `AuditLog` (actor, Workspace, command, outcome), independent of the chat UI.

## Guardrails

Because the model can run arbitrary shell commands rather than picking from a fixed set of functions, every safety property here comes from the layer *around* the model — the model's own judgement is never the thing standing between it and a destructive action.

1. **Sandboxed, ephemeral execution.** Commands never run on the backend host. Each chat session gets its own short-lived, isolated container (or equivalent) with only the required CLI tools installed. It's destroyed/recycled after the session ends or after a timeout, so nothing persists between sessions by default.
2. **Binary allowlist, not a denylist.** The sandbox only has the specific CLI tools it needs (`aws` today, more per-CSP tools as they're added) — not a general-purpose shell with `bash`, `python`, `curl` to arbitrary hosts, package managers, etc. If it isn't an allowlisted binary, the policy layer rejects the command before it reaches the sandbox at all.
3. **Least-privilege, scoped credentials.** The credentials injected per session are the ones attached to that specific Workspace only, and should themselves carry a CSP-side IAM policy scoped to what that mode/sub-mode is meant to do (e.g. a FinOps analytics session's IAM role has read-only billing/resource permissions, full stop — the shell being flexible doesn't mean the underlying credential is).
4. **Deterministic command classification.** Read-only vs. mutating is decided by code (pattern-matching the command against known safe verbs, dry-run flags, etc.), not by asking the model to self-report. This is what the confirmation gate keys off of, so a manipulated or confused model can't talk its way past it.
5. **Human confirmation before any mutating command.** No create/update/delete/terminate/stop action — in AIOps or in FinOps Waste Management — executes without the Operator explicitly confirming the literal command shown to them first.
6. **Dry-run first, where available.** For tools that support it (e.g. `--dry-run` on many `aws` subcommands, `terraform plan` before `apply`), the policy layer should prefer forcing a dry-run pass and showing the resulting plan/diff before allowing the real confirmed execution.
7. **Session-level resource and spend caps.** Independent of anything the model decides, enforce hard limits per session/Workspace — e.g. a maximum number of resources created, or a spend ceiling — checked server-side before executing a confirmed mutating command, so a runaway or manipulated conversation can't scale damage indefinitely.
8. **Network egress restriction.** The sandbox can reach the specific CSP's API endpoints only — no general internet access, no reaching the doc-lookup source through anything other than the fixed, curated path described below. This closes off both exfiltration and "the model was tricked by content it found on the open web."
9. **Curated, read-only doc lookup — not open browsing.** When the model needs to check correct syntax, it queries local `--help`/`man` output from the same allowlisted binaries, or a fixed, pre-approved cache of official CLI documentation. It never does a general web search or fetches arbitrary URLs — that would reopen the sandbox to untrusted content steering its next command (prompt injection via search results).
10. **Output sanitization.** Command output is scrubbed for anything that looks like a secret/credential before it's fed back to the model, stored in chat history, or shown to the Operator.
11. **Timeouts and resource limits.** Every command execution has a hard wall-clock timeout and CPU/memory ceiling inside the sandbox; anything that exceeds it is killed and reported as a failure, not left running.
12. **Full, tamper-evident audit trail.** Every command — proposed, confirmed or cancelled, executed, and its outcome — is logged to `AuditLog` with actor, Workspace, and timestamp, independent of the chat transcript, so it survives even if chat history were ever altered or deleted.
13. **Pinned tool versions.** The sandbox image ships specific, version-pinned CLI tool builds that are deliberately updated and reviewed, rather than auto-updating on every run — so a compromised upstream package can't silently change what the sandbox is capable of.

### Known gaps (Phase 6, landed on `dev`)

Phase 6 is implemented and merged (`backend/src/ai/**`), with two guardrails only partially satisfied — tracked here deliberately rather than left to be rediscovered:

- **Guardrail 8 (network egress restriction) — not implemented.** `backend/src/ai/sandbox/sandboxManager.js` runs containers on Docker's default `bridge` network, so a sandbox has full outbound internet access rather than being restricted to the CSP's API endpoints only. Needs a network firewall/egress-proxy layer (e.g. an allowlist of the CSP's published IP ranges, or a forward proxy the container is forced through) before this guardrail is actually met.
- **Guardrail 7 (spend ceiling) — partially implemented.** The session-level *resource* cap (`ChatSession.mutatingCommandCap`/`mutatingCommandCount`) is enforced atomically. The admin-configurable `ChatSettings.spendCeilingUsd` field is stored but never checked (`backend/src/modules/admin/chatSettings.schemas.js`) — no real-time cost estimation exists yet.

## Docker packaging (docker-compose.yml — prod-like / distribution run only)

Four services:

1. `postgres` — `postgres:16`, named volume, `pg_isready` healthcheck.
2. `minio` — `minio/minio` image, named volume, exposes the S3 API and console ports, healthcheck against its `/minio/health/live` endpoint. Include a one-shot init step/command (or document a manual step) to create the bucket named in `S3_BUCKET` on first run.
3. `backend` — plain Node runtime image, `npm ci --omit=dev`, no build step needed (plain JS). Depends on both `postgres` and `minio` healthchecks. Runs Prisma migrations on startup before starting the server. Uses `env_file: backend/.env`.
4. `frontend` — multi-stage build (`npm run build`, then `nginx:alpine` serving `dist/`). Uses `env_file: frontend/.env` (Vite vars are baked in at build time).

Shared bridge network. Expose only frontend (and backend if you want direct API access) to the host; keep postgres and minio internal-only.

## `dev.sh`

This script does exactly one thing: start backend and frontend on the host for local development. It does **not** touch Postgres, MinIO, or any other infrastructure — assume `backend/.env` already points at a running DB and storage bucket that I've set up myself.

1. Start backend in dev mode (`npm run dev` inside `backend/`, e.g. `nodemon`) in the background.
2. Start frontend in dev mode (`npm run dev` inside `frontend/`) in the foreground.
3. Prefix each process's log output clearly (e.g. `[backend]` / `[frontend]`).
4. Trap `SIGINT` so Ctrl+C kills both processes cleanly.
5. Print both URLs once up.

## Other setup

- Root `README.md` explaining: `./dev.sh` for local dev (DB/storage assumed already running), `docker compose up` for the fully containerized run.
- `.gitignore`: `node_modules`, `.env`, `dist`, `build`.
- ESLint + Prettier for both frontend and backend, consistent rules.
- `.github/workflows/ci.yml` stub: install deps, lint, and a basic build/test step for both frontend and backend.

Ask before making architectural decisions not covered above (e.g. exact JWT vs cookie session handling, precise dashboard layout details) if the alternative meaningfully changes the setup — otherwise pick sensible defaults and proceed.

## Suggested build order (so this can span multiple Claude Code sessions)

This plan is intentionally big — don't try to build all of it in a single sitting. Work through it in the phases below, and stop cleanly at the end of any phase. Because this whole document stays in the project folder, a fresh Claude Code session can just re-read `PLAN.md`, see what already exists in the repo, and pick up from wherever the last session left off — there's no need to hold the whole plan in one running session.

1. **Phase 0 — Scaffolding.** Repo layout, `frontend/` and `backend/` skeletons, `.env.example` files in each, `dev.sh`, `README.md`, lint/format configs, CI stub. No real features yet — just confirm `dev.sh` brings up an empty frontend and an empty backend that can reach the DB (`/readyz` returns OK).
2. **Phase 1 — Data model.** Full Prisma schema (all models listed above) and initial migration, run against the DB I've already set up. No business logic yet, just the schema in place.
3. **Phase 2 — Auth & MFA.** `modules/open` (health), `modules/auth` (login, TOTP enrollment/verification, backup codes, change password), `middleware`, `constants`, `crypto` envelope-encryption helper with tests. Seed the master `admin` user. Confirm end-to-end: login → MFA → JWT issued.
4. **Phase 3 — Frontend shell.** Login page (split-screen layout), MFA screens, top nav bar (logo, settings/theme, profile menu), routing/redirect to a placeholder Dashboard. No admin/operator-specific screens yet.
5. **Phase 4 — Admin modules.** `modules/admin` (Manage Administrators, Manage Operators, Manage Organisations with nested Workspaces, Manage Chat Settings, Manage Branding, Manage Chats read-only view) plus their frontend screens.
6. **Phase 5 — Operator dashboard & chat UI.** Sidebar (Cloud/On-Prem toggle, workspace selector, mode list, recent history), AIOps and FinOps chat screens, Chat History full-page view with search.
7. **Phase 6 — AI agent execution.** `backend/src/ai/` provider abstraction, the sandboxed shell execution environment, the CLI binary allowlist and command-classification policy layer, the doc-lookup path, the system-prompt-per-mode mechanism, the confirm-before-execute gate for mutating commands, session-level resource/spend caps, and persistence to chat history + audit log.
8. **Phase 7 — Docker packaging.** `docker-compose.yml` (postgres, minio, backend, frontend) for the distributable, prod-like run, verified as a full `docker compose up` from a clean checkout.
9. **Phase 8 — Branching & release automation.** Set up `dev`/`release` branches, semantic-release config, and the `release.yml` GitHub Actions workflow described below.

At the start of any new session, a good first message is: "Read PLAN.md and the current repo state, tell me which phase we're on, and continue from there."

## Branching, CI/CD, and versioning

- **`dev`** — all regular commits and feature work land here.
- **`release`** — protected branch; changes reach it only via a pull request from `dev`. Merging into `release` is what triggers the automated steps below.
- **Version bumping**: use **semantic-release** (free, open source, the standard tool for this). Wire it into the `release.yml` workflow so it runs on every push to `release` (i.e. every PR merge): it reads Conventional Commit messages (`feat:`, `fix:`, `feat!:`/`BREAKING CHANGE:`, etc.) since the last tag, computes the next semantic version, updates `package.json` in `frontend/` and `backend/`, generates a changelog, creates the Git tag, and publishes a GitHub Release — all in that single workflow run, no separate release PR to merge.
- **Docker build on release**: the same `.github/workflows/release.yml`, right after the semantic-release step, that:
  1. Builds the `backend/Dockerfile` and `frontend/Dockerfile` images.
  2. Tags each image with the version semantic-release just computed, plus `latest`.
  3. Pushes both to **GitHub Container Registry (GHCR)** — free, tied to the repo's own GitHub auth, no separate account/registry to manage.
  4. Anyone can then `docker pull ghcr.io/<org>/<repo>-backend:<version>` (and `-frontend`) to run it via the `docker-compose.yml` from Phase 6, pointed at those published images instead of a local build.
- All of the above (GitHub Actions minutes, GHCR storage, semantic-release) are free for this use case — no paid service required.
