# Releases

- **`dev`** — all regular commits and feature work land here.
- **`release`** — protected; only reachable via a pull request from `dev`. `release`'s protection must be configured as a GitHub Ruleset (not legacy branch protection) with a bypass entry for the repository admin role — the release workflow pushes its own version-bump commit directly to `release`, and a rule that requires a PR for every push, with no bypass, will break that step. Merging a PR into `release` triggers `.github/workflows/release.yml`, which:
  1. Runs [semantic-release](https://semantic-release.gitbook.io/) against the Conventional Commit messages (`feat:`, `fix:`, `feat!:`/`BREAKING CHANGE:`, etc.) merged since the last release, computing the next semantic version.
  2. Bumps `frontend/package.json` and `backend/package.json` to that version, updates `CHANGELOG.md`, commits both back to `release`, tags the commit (`vX.Y.Z`), and publishes a GitHub Release with generated notes.
  3. If (and only if) a new version was actually released, builds `backend/Dockerfile` and `frontend/Dockerfile` and pushes both to GitHub Container Registry, tagged with that version and `latest`.

Pull a released image instead of building locally:

```sh
docker pull ghcr.io/<owner>/opencai-backend:latest
docker pull ghcr.io/<owner>/opencai-frontend:latest
```

(replace `<owner>` with this repo's GitHub owner, lowercased) — then point `docker-compose.yml`'s `backend`/`frontend` services at these images instead of `build: ./backend`/`build: ./frontend` to run a fully pre-built stack. The published `-frontend` image has `VITE_API_BASE_URL=http://localhost:4000` baked in at build time (matching `.env.example`'s default), so deploying to a non-localhost host requires rebuilding the frontend image yourself with your own `VITE_API_BASE_URL` rather than pulling the published one.

Commit messages on `dev` (and therefore in any PR merged to `release`) must follow [Conventional Commits](https://www.conventionalcommits.org/) for semantic-release to compute the right version bump — a plain `fix: ...`/`feat: ...` prefix is enough for most changes; `feat!:` or a `BREAKING CHANGE:` footer signals a major version bump. The `dev` → `release` PR must be merged with a merge commit (not squash), so each Conventional Commit stays individually visible to semantic-release.
