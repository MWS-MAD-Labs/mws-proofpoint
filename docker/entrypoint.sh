#!/bin/sh
set -e

# ============================================
# ProofPoint Dashboard - Docker Entrypoint
# ============================================

echo "🚀 Starting ProofPoint Dashboard..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-proofpoint}" -q; do
  echo "   PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "✅ PostgreSQL is ready!"

# Wait for MinIO to be ready (optional)
if [ -n "$MINIO_ENDPOINT" ]; then
  echo "⏳ Waiting for MinIO to be ready..."
  MINIO_HOST=$(echo "$MINIO_ENDPOINT" | sed -e 's|http://||' -e 's|https://||' -e 's|:.*||')
  MINIO_PORT=$(echo "$MINIO_ENDPOINT" | sed -e 's|.*:||' -e 's|/.*||')
  until curl -sf "http://${MINIO_HOST}:${MINIO_PORT:-9000}/minio/health/live" > /dev/null 2>&1; do
    echo "   MinIO is unavailable - sleeping"
    sleep 2
  done
  echo "✅ MinIO is ready!"
fi

# Run database migrations if migration files exist
if [ -d "/app/database/migrations" ] && [ "$(ls -A /app/database/migrations 2>/dev/null)" ]; then
  echo "📦 Running database migrations..."
  for migration in /app/database/migrations/*.sql; do
    if [ -f "$migration" ]; then
      echo "   Applying: $(basename "$migration")"
      PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST:-postgres}" \
        -p "${POSTGRES_PORT:-5432}" \
        -U "${POSTGRES_USER:-proofpoint}" \
        -d "${POSTGRES_DB:-proofpoint}" \
        -f "$migration" \
        -v ON_ERROR_STOP=0 \
        > /dev/null 2>&1 || echo "   (already applied or skipped)"
    fi
  done
  echo "✅ Migrations complete!"
fi

echo "🌐 Starting Next.js server on port ${PORT:-3000}..."

# Execute the main command
exec "$@"
