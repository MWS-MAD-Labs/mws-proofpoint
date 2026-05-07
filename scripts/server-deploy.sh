#!/bin/bash

# =====================================================
# Server-Side Deployment Script
# =====================================================
# This script runs on the server after git pull
# Usage: ./scripts/server-deploy.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="/root/proofpoint-dashboard"
APP_CONTAINER="proofpoint-app"
DB_CONTAINER="proofpoint-db"

log_info() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[DEPLOY]${NC} $1"
}

log_error() {
    echo -e "${RED}[DEPLOY]${NC} $1"
}

cd "$APP_DIR"

# 1. Create database backup
log_info "Creating database backup..."
BACKUP_FILE="/tmp/proofpoint_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec "$DB_CONTAINER" pg_dump -U proofpoint proofpoint > "$BACKUP_FILE"
log_info "Backup created: $BACKUP_FILE"

# 2. Pull latest code
log_info "Pulling latest code from git..."
git fetch origin
git reset --hard origin/main

# 3. Install dependencies
log_info "Installing dependencies..."
npm ci

# 4. Generate Prisma Client
log_info "Generating Prisma Client..."
npm run db:generate

# 5. Apply database migrations
log_info "Applying database migrations..."
npm run db:migrate:deploy

# 6. Build application
log_info "Building application..."
npm run build

# 7. Restart application
log_info "Restarting application..."
docker-compose restart app

# 8. Wait for startup
log_info "Waiting for application to start..."
sleep 15

# 9. Health check
log_info "Checking application health..."
if docker ps | grep -q "$APP_CONTAINER"; then
    log_info "Container is running ✓"

    # Try HTTP check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3060 || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        log_info "Application is responding (HTTP: $HTTP_CODE) ✓"
    else
        log_warn "Application might still be starting (HTTP: $HTTP_CODE)"
    fi
else
    log_error "Container failed to start!"
    log_error "Check logs: docker logs $APP_CONTAINER"
    exit 1
fi

log_info "Deployment completed successfully! 🚀"
