# Setup guide (Windows, macOS and Linux)

There are two ways to run OpenCAI. Pick one.

| | Option A: Docker Compose | Option B: on your machine |
|---|---|---|
| Use it to | run or try OpenCAI | develop OpenCAI, with live reload |
| You install | Git and Docker | Git, Docker and Node.js 24+ |
| Postgres and MinIO | started for you | you provide them |
| Web app | http://localhost:8080 | http://localhost:5270 |

Docker is needed in both: the AI agent runs every command in a Docker container.

## Install the tools

**Windows**

- Install [Git for Windows](https://git-scm.com/download/win) and
  [Docker Desktop](https://www.docker.com/products/docker-desktop/), and start Docker Desktop.
- Run every command below in **Git Bash** (installed with Git for Windows), not in Command Prompt
  or PowerShell.
- Option B only: install [Node.js 24+](https://nodejs.org/).

**macOS**

- Install [Homebrew](https://brew.sh/), then `brew install git`.
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
- Option B only: `brew install node`.

**Linux**

- Install Git from your package manager.
- Install [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin, and
  allow your user to run it without `sudo` (`sudo usermod -aG docker $USER`, then log out and
  back in).
- Option B only: install Node.js 24+ with [nvm](https://github.com/nvm-sh/nvm) (`nvm install 24`)
  or your distribution's packages.

## Option A: Docker Compose

One command starts everything: Postgres, MinIO (and its bucket), the backend and the web app.
Node.js is not needed on your machine; it runs inside the containers.

```sh
git clone https://github.com/AB527/opencai.git
cd opencai
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit two files before the first start:

- `backend/.env`: set `JWT_SECRET` to the output of `openssl rand -base64 48` and
  `MASTER_ENCRYPTION_KEY` to the output of `openssl rand -base64 32`. The database and storage
  values are overridden by `docker-compose.yml`, so leave them as they are.
- `frontend/.env`: set `VITE_API_BASE_URL=http://localhost:4000`. Under Compose the backend
  listens on port 4000, and this value is built into the web app.

Then build the sandbox image and start the stack:

```sh
docker build -t opencai-sandbox:2.15.30 backend/sandbox
docker compose up --build -d
docker compose exec backend npm run prisma:seed   # first run only
```

- Web app: http://localhost:8080
- Backend API: http://localhost:4000

Continue with [First sign-in](#first-sign-in). See [Notes on the Docker Compose run](#notes-on-the-docker-compose-run)
for how to stop the stack and for the security notes on this setup.

## Option B: on your machine

`dev.sh` runs the backend and the web app directly with Node.js, so code changes reload at once.
It does not start Postgres or MinIO; both must already be reachable. `docker compose` cannot
provide them here, because it does not publish Postgres to your machine. If you have neither, one
way to start both is:

```sh
docker run -d --name opencai-postgres -p 5432:5432 \
  -e POSTGRES_USER=opencai -e POSTGRES_PASSWORD=opencai -e POSTGRES_DB=opencai postgres:16

docker run -d --name opencai-minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=opencai -e MINIO_ROOT_PASSWORD=opencai12345 \
  cgr.dev/chainguard/minio:latest server /data --console-address ":9001"
```

Then open the MinIO console at http://localhost:9001, sign in with that user and password, and
create a bucket named `opencai`.

Clone and configure:

```sh
git clone https://github.com/AB527/opencai.git
cd opencai
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:

- `DATABASE_URL`: your Postgres connection string. The default matches the command above.
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`: your storage. For the MinIO
  command above, the access key is `opencai` and the secret key is `opencai12345`.
- `JWT_SECRET` and `MASTER_ENCRYPTION_KEY`: generate each one with the command written next to it
  in the file.

`frontend/.env` works as it is.

Install, prepare the database, build the sandbox image and start:

```sh
(cd backend && npm install)
(cd frontend && npm install)
(cd backend && npx prisma migrate deploy && npm run prisma:seed)
docker build -t opencai-sandbox:2.15.30 backend/sandbox
./dev.sh
```

- Web app: http://localhost:5270
- Backend API: http://localhost:5271

## First sign-in

The seed creates the master admin and the default agent personas. Sign in as `admin` with the
password `admin` (or the value of `SEED_ADMIN_PASSWORD` if you set one), enrol MFA with an
authenticator app, and change the password. Then, as Administrator, set the provider, model and
API key in Manage Chat Settings, add an Organisation with a Workspace and its AWS credentials, and
create an Operator.

## Notes on the Docker Compose run

`docker compose down` stops the stack and keeps its data (named volumes); add `-v` to also delete
the Postgres/MinIO data.

Note: the `backend` container mounts the host's Docker socket so the AI agent orchestrator can
provision sandbox containers as siblings on the host — this gives the backend container
host-level Docker control, a deliberate trade-off for how the sandboxed command execution in
Phase 6 works (see PLAN.md's Guardrails section). Given that access, this stack is intended for a
trusted local/single-tenant run only and must never be exposed to an untrusted network.

Note: `opencai` / `opencai12345` (the postgres/minio credentials hardcoded in `docker-compose.yml`)
are local development defaults — change them in both `docker-compose.yml` and `backend/.env` before
this stack is ever reachable from anything beyond localhost.

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
