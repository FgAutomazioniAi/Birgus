#!/bin/sh
set -eu

if [ "$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.shipments') IS NOT NULL")" = "t" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/decommission-shipments.sql
fi

npm run db:push
npm run db:bootstrap
npm run db:sync:workflow-tools
exec npm run dev
