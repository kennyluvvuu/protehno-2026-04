#!/bin/sh
set -eu

echo "[backend-entrypoint] Waiting for PostgreSQL to become available..."

max_attempts="${DB_WAIT_MAX_ATTEMPTS:-30}"
attempt=1

until bun -e "const { Client } = require('pg'); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => client.end()).then(() => process.exit(0)).catch(() => process.exit(1));"; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[backend-entrypoint] PostgreSQL is unavailable after ${max_attempts} attempts."
    exit 1
  fi

  echo "[backend-entrypoint] PostgreSQL is not ready yet (attempt ${attempt}/${max_attempts}). Retrying in 2 seconds..."
  attempt=$((attempt + 1))
  sleep 2
done

echo "[backend-entrypoint] PostgreSQL is ready."
echo "[backend-entrypoint] Running drizzle-kit push..."

bun run db:push

echo "[backend-entrypoint] Starting backend..."
exec bun run src/index.ts
