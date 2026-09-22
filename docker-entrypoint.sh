#!/bin/sh
set -eu

mkdir -p "$UPLOADS_DIR"
chown -R node:node "$UPLOADS_DIR"

runuser -u node -- pnpm --filter @workspace/db run migrate:production

exec runuser -u node -- "$@"