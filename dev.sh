#!/usr/bin/env bash
# Starts backend + frontend on the host for local development.
# Does NOT touch Postgres, MinIO, or any other infrastructure —
# assume backend/.env already points at a DB and storage bucket you run yourself.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

get_env_var() {
  # get_env_var <file> <key> — prints the value if present, nothing otherwise.
  if [ -f "$1" ]; then
    grep -E "^$2=" "$1" | head -n 1 | cut -d '=' -f2- | tr -d '\r'
  fi
}

BACKEND_PORT="$(get_env_var "$SCRIPT_DIR/backend/.env" PORT)"
BACKEND_PORT="${BACKEND_PORT:-4000}"

FRONTEND_PORT="${FRONTEND_PORT:-5270}"

BACKEND_PID=""
FRONTEND_PID=""

kill_tree() {
  # kill_tree <pid> — force-kill a process and, on Windows, its full descendant
  # tree (nodemon/vite spawn extra cmd.exe/node.exe hops that plain `kill` won't reach).
  local pid="$1"
  [ -z "$pid" ] && return 0
  kill -0 "$pid" 2>/dev/null || return 0
  case "$(uname -s)" in
    MINGW*|MSYS*)
      taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
      ;;
  esac
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

cleanup() {
  trap - INT TERM EXIT
  kill_tree "$FRONTEND_PID"
  kill_tree "$BACKEND_PID"
}
trap cleanup INT TERM EXIT

(cd "$SCRIPT_DIR/backend" && npm run dev 2>&1 | sed -u 's/^/[backend] /') &
BACKEND_PID=$!

echo "[dev] backend:  http://localhost:${BACKEND_PORT}"
echo "[dev] frontend: http://localhost:${FRONTEND_PORT}"

(cd "$SCRIPT_DIR/frontend" && npm run dev 2>&1 | sed -u 's/^/[frontend] /') &
FRONTEND_PID=$!

set +e
wait "$FRONTEND_PID"
set -e
