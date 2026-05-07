#!/bin/bash

# =====================================================
# Komodo Deployment Script for ProofPoint Dashboard
# =====================================================
# This script is triggered by GitHub Actions webhook
# It pulls the new Docker image and updates the running container

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[KOMODO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[KOMODO]${NC} $1"
}

log_error() {
    echo -e "${RED}[KOMODO]${NC} $1"
}

# Configuration
APP_DIR="/root/proofpoint-dashboard"
APP_CONTAINER="proofpoint-app"
DB_CONTAINER="proofpoint-db"
IMAGE_NAME="${1:-ghcr.io/faisalnh/proofpoint-dashboard:latest}"

# Log deployment start
log_info "Deployment started at $(date)"
log_info "Image: $IMAGE_NAME"

cd "$APP_DIR"

# 1. Create database backup
log_info "Creating database backup..."
BACKUP_FILE="/tmp/proofpoint_backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec "$DB_CONTAINER" pg_dump -U proofpoint proofpoint > "$BACKUP_FILE"
log_info "Backup created: $BACKUP_FILE"

# 2. Pull latest code (for migration files and config)
log_info "Pulling latest code from git..."
git fetch origin
git reset --hard origin/main

# 3. Login to GitHub Container Registry
log_info "Logging in to GitHub Container Registry..."
echo "${GITHUB_TOKEN}" | docker login ghcr.io -u "${GITHUB_USERNAME}" --password-stdin

# 4. Pull new Docker image
log_info "Pulling new Docker image..."
docker pull "$IMAGE_NAME"

# 5. Update docker-compose.yml to use new image
log_info "Updating docker-compose configuration..."
sed -i "s|image: ghcr.io/faisalnh/proofpoint-dashboard:.*|image: $IMAGE_NAME|g" docker-compose.yml

# 6. Apply database migrations
log_info "Applying database migrations..."
if [ -f "package.json" ]; then
    npm ci
    npm run db:generate
    npm run db:migrate:deploy
fi

# 7. Stop and remove old container
log_info "Stopping old container..."
docker-compose stop app
docker-compose rm -f app

# 8. Start new container
log_info "Starting new container..."
docker-compose up -d app

# 9. Wait for application to start
log_info "Waiting for application to start..."
sleep 20

# 10. Health check
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

    # Show container logs
    log_info "Recent container logs:"
    docker logs --tail 20 "$APP_CONTAINER"
else
    log_error "Container failed to start!"
    log_error "Check logs: docker logs $APP_CONTAINER"

    # Rollback to previous image
    log_warn "Attempting rollback..."
    git reset --hard HEAD~1
    docker-compose up -d app
    exit 1
fi

# 11. Cleanup old images
log_info "Cleaning up old Docker images..."
docker image prune -af --filter "until=24h"

log_info "Deployment completed successfully! 🚀"
log_info "Deployed at: $(date)"
