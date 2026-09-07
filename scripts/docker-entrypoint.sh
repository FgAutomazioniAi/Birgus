#!/bin/sh
set -eu

PSQL_DATABASE_URL="${DATABASE_URL%%\?*}"

psql "$PSQL_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/decommission-shipments.sql

npm run db:push
npm run db:bootstrap
npm run db:sync:workflow-tools
exec npm run dev
