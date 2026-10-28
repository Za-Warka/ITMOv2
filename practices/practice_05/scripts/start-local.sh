#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_ENV="$BACKEND_DIR/.env.local"

if [[ ! -f "$BACKEND_ENV" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_ENV"
  echo "Создан $BACKEND_ENV из .env.example"
fi

cleanup() {
  trap - EXIT INT TERM
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  cd "$BACKEND_DIR"
  set -a
  source "$BACKEND_ENV"
  set +a
  exec go run ./cmd/api
) &
BACKEND_PID=$!

echo "Запускаю Go API..."
for _ in {1..30}; do
  if curl --silent --fail http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --silent --fail http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
  echo "Не удалось запустить Go API на http://127.0.0.1:8080" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  exec npm run dev
) &
FRONTEND_PID=$!

echo ""
echo "Repo Atlas запущен: http://127.0.0.1:3000"
echo "Остановить оба сервера: Ctrl+C"
echo ""

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
