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
    err="$(mktemp)"
    if ! bin/litestream restore -config litestream.yml -if-replica-exists "$DB_PATH" >"$err" 2>&1; then
      # The bucket can't be read right now (e.g. its free daily cap is used up). Start anyway so the
      # app stays up, but don't back up: an empty copy must never go up over the saved episodes.
      cat "$err" >&2
      rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
      export CROSSTALK_RESTORE=failed
      CROSSTALK_RESTORE_ERROR="$( (grep -v '^$' "$err" || true) | tail -n 1 | cut -c1-400)"
      export CROSSTALK_RESTORE_ERROR
      echo "Backup: couldn't read the bucket, so starting without the saved episodes and without backing up. Restart once it's reachable." >&2
      exec npm start
    fi
    cat "$err"
    # Tell the app how it started, so Settings can say "brought back" or "the bucket was empty".
    if [ -f "$DB_PATH" ]; then export CROSSTALK_RESTORE=restored; echo "Backup: brought the saved episodes back."; else export CROSSTALK_RESTORE=empty; echo "Backup: the bucket had nothing to bring back, starting empty." >&2; fi
  fi
  export CROSSTALK_BACKUP=on
  # The server runs directly (not through npm) so a stop signal reaches it and the backup waits for it to close.
  exec bin/litestream replicate -config litestream.yml -exec "node_modules/.bin/tsx apps/server/src/index.ts"
fi
exec npm start
