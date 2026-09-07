#!/bin/sh
set -eu

npm run db:push
npm run db:bootstrap
npm run db:sync:workflow-tools
exec npm run dev
