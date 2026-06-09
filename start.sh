#!/bin/sh
set -e
echo "[startup] Pushing schema to database..."
node node_modules/.bin/prisma db push --schema=packages/server/prisma/schema.prisma --accept-data-loss
echo "[startup] Starting server..."
exec node packages/server/dist/index.js
