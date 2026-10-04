# Report

## Project Title

OpenCAI: Open Cloud AI

## Description

OpenCAI is a white-label AIOps and FinOps platform that lets teams manage their cloud by simply chatting with an AI agent. Operators ask in plain language to inspect resources, troubleshoot issues or analyse costs; the agent proposes the exact cloud commands, explains them, and runs them in isolated Docker sandboxes only after the operator approves. Administrators control which organisations, cloud workspaces and team members it can reach, while MFA sign-in and encrypted credentials keep every action secure and auditable.

## Tags (Comma Separated)

AI, Web App, Cloud, Docker, AIOps, FinOps, AWS, React, Vite, Tailwind CSS, Node.js, Express, Prisma, PostgreSQL, MinIO, PWA

## External Links (Optional URLs)

https://github.com/AB527/opencai

## Workbook

### Wk 1 — Project Setup & Data Model

Scaffolded the repository layout with backend and frontend skeletons and dev tooling. Designed the full Prisma data model and created the initial PostgreSQL migration.

### Wk 2 — Authentication & Frontend Shell

Built authentication with login, TOTP-based MFA, backup codes and change-password. Created the frontend shell with login and MFA screens, top navigation and routing.

### Wk 3 — Admin Modules & Operator Dashboard

Added the admin modules for Administrators, Operators, Organisations, Workspaces, Chat Settings, Branding and Chats oversight. Built the operator dashboard and chat UI.

### Wk 4 — AI Agent Engine Core

Added the agent schema and seed data, Anthropic and OpenAI provider adapters and the system prompt service. Built the command policy classifier, output sanitizer, non-root Docker sandbox manager and the agent orchestrator.

### Wk 5 — Agent Integration

Wired the chat module to the agent orchestrator and extended admin chat settings with an agent personas API. Connected the operator chat UI to the real agent backend and documented the remaining guardrail gaps.

### Wk 6 — Containerisation & Release Automation

Added backend and frontend Dockerfiles and a docker-compose setup with PostgreSQL and MinIO. Set up semantic-release with GHCR image publishing, documented the branch model, and added Gemini and Groq providers.

### Wk 7 — Reliability, UX & Polish

Made the agent loop recover from failures and added multi-region runs. Reworked the chat UI, history and session handling, added the NVIDIA provider, toasts, dialogs, a PWA install prompt, MFA reset and workflow diagrams.
