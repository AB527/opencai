# Contributing to OpenCAI

Thanks for helping with OpenCAI. This page covers how to set up, what to check before you open a
pull request, and the conventions the project follows.

## Getting set up

Follow the [setup guide](./docs/SETUP.md). It covers Windows, macOS and Linux. [`PLAN.md`](./PLAN.md) describes the architecture and the guardrails
around the AI agent, and [`docs/workflows/`](./docs/workflows/README.md) has diagrams of the main
flows.

## Branches

- **`dev`** is where all work lands. Branch from `dev` and open your pull request against `dev`.
- **`release`** is protected. It only receives pull requests from `dev`, and merging one publishes
  a new version (see [Releases](./docs/RELEASES.md)). Do not open pull requests against it
  directly.

## Before you open a pull request

CI runs these on every push and pull request. Run them locally first.

Backend, from `backend/`:

```sh
npm run lint
npx prisma validate
npm test
```

Frontend, from `frontend/`:

```sh
npm run lint
npm run build
```

`npm run format` (Prettier) is available in both folders.

Also:

- Add or update tests for backend changes. Tests sit next to the code as `*.test.js` and run with
  the built-in Node.js test runner.
- If you change the Prisma schema, include the migration in `backend/prisma/migrations/`.
- If you change behaviour that a diagram in `docs/workflows/` describes, update the diagram in the
  same change. [`docs/workflows/README.md`](./docs/workflows/README.md) explains how.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/). The release workflow reads them
to compute the next version, so the prefix matters:

- `fix: ...` for a bug fix (patch release)
- `feat: ...` for a new feature (minor release)
- `feat!: ...` or a `BREAKING CHANGE:` footer for a breaking change (major release)
- `docs:`, `chore:`, `test:`, `refactor:` for changes that should not trigger a release

A scope is welcome, for example `feat(admin): ...` or `fix(docker): ...`.

## Code conventions

- Plain JavaScript in both `backend/` and `frontend/`. No TypeScript and no backend build step.
- Each backend module in `backend/src/modules/` keeps its own `*.controller.js`, `*.service.js`
  and `*.route.js`. Modules do not import from each other; share data through the Prisma models.
- Spell terms out in the UI and copy: "Organisation", not "Org". Established short forms such as
  "Admin", CSP, IAM and ARN are fine.

## Changes to the AI agent

The safety of the agent comes from the code around the model, not from the model. If you touch
`backend/src/ai/`:

- Keep the command policy default-deny. Anything not positively recognised as read-only or
  mutating must stay rejected.
- Never let a mutating command run without the Operator's confirmation.
- Never put credentials in a prompt, a log or a chat message.
- Add tests for every new policy rule, sanitiser pattern or sandbox option.

## Secrets and security

- Never commit `.env` files, API keys or cloud credentials. Only the `.env.example` files belong
  in the repository.
- If you find a security problem, tell the maintainers privately instead of opening a public issue.
