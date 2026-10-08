#!/usr/bin/env bash
# Starts CrossTalk. With a backup set up (BACKUP_BUCKET and friends), it first brings back the saved
# episodes and Iris's sketches, then keeps copying every change to cloud storage while it runs.
# Without one, it simply starts.
set -euo pipefail
cd "$(dirname "$0")/.."
export DB_PATH="${DB_PATH:-$PWD/apps/server/data/crosstalk.sqlite}"

if [ -n "${BACKUP_BUCKET:-}" ]; then
  for v in BACKUP_ENDPOINT BACKUP_KEY_ID BACKUP_SECRET; do
    if [ -z "${!v:-}" ]; then echo "Backup is half set up: $v is missing. Starting without a backup." >&2; exec npm start; fi
  done
  export BACKUP_REGION="${BACKUP_REGION:-us-east-1}"
  mkdir -p "$(dirname "$DB_PATH")"
  if [ ! -f "$DB_PATH" ]; then
    bin/litestream restore -config litestream.yml -if-replica-exists "$DB_PATH"
  fi
  export CROSSTALK_BACKUP=on
  # The server runs directly (not through npm) so a stop signal reaches it and the backup waits for it to close.
  exec bin/litestream replicate -config litestream.yml -exec "node_modules/.bin/tsx apps/server/src/index.ts"
fi
exec npm start
