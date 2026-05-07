#!/bin/bash

# Script untuk run migrasi sebelum aplikasi start

echo "Waiting for database to be ready..."
until pg_isready -h postgres -U proofpoint; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready - running migrations"

# Set DATABASE_URL untuk Prisma
export DATABASE_URL="postgresql://proofpoint:${POSTGRES_PASSWORD}@postgres:5432/proofpoint"

# Run migrations
npx prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "Migrations completed successfully"
else
  echo "Migrations failed"
  exit 1
fi