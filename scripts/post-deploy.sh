#!/bin/bash

# =====================================================
# Server-Side Post-Deploy Hook
# =====================================================
# This script runs on the server after deployment
# Place this in: /root/proofpoint-dashboard/scripts/post-deploy.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/root/proofpoint-dashboard"
APP_CONTAINER="proofpoint-app"
DB_CONTAINER="proofpoint-db"

log_info() {
    echo -e "${GREEN}[POST-DEPLOY]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[POST-DEPLOY]${NC} $1"
}

cd "$APP_DIR"

# 1. Generate Prisma Client
log_info "Generating Prisma Client..."
npm run db:generate

# 2. Apply database migrations
log_info "Checking for pending migrations..."
npm run db:migrate:deploy

# 3. Clear Next.js cache
log_info "Clearing Next.js cache..."
rm -rf .next

# 4. Restart application
log_info "Restarting application..."
docker-compose restart app

# 5. Wait for health check
log_info "Waiting for application to be healthy..."
sleep 15

# 6. Verify application is running
if docker ps | grep -q "$APP_CONTAINER"; then
    log_info "Application is running ✓"

    # Optional: Run health check
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3060/api/health || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        log_info "Application is responding to requests ✓"
    else
        log_warn "Application might not be fully ready yet (HTTP: $HTTP_CODE)"
    fi
else
    log_warn "Container not running. Check logs with: docker logs $APP_CONTAINER"
    exit 1
fi

log_info "Post-deploy completed successfully! 🚀"
