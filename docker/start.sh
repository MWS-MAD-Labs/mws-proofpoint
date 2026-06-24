#!/bin/sh
set -e

KNOWN_FAILED_MIGRATION="20260501000000_add_workflow_definitions"

echo "🚀 Starting ProofPoint Dashboard..."
echo "📦 Running Prisma migrations..."

if ! npx prisma migrate deploy; then
  echo "⚠️ Prisma migrate deploy failed. Checking for known recoverable migration failure..."

  if [ "${PRISMA_AUTO_REPAIR_KNOWN_MIGRATIONS:-true}" = "true" ]; then
    node /app/scripts/repair-known-prisma-migration.mjs
    echo "🔁 Retrying Prisma migrations after repair..."
    npx prisma migrate deploy
  else
    echo "Automatic migration repair is disabled. Set PRISMA_AUTO_REPAIR_KNOWN_MIGRATIONS=true to enable."
    exit 1
  fi
fi

echo "✅ Prisma migrations complete."
echo "🌐 Starting Next.js server on port ${PORT:-3000}..."
exec node server.js
