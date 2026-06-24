#!/bin/bash

# =====================================================
# ProofPoint Dashboard - Deployment Script
# =====================================================
# This script automates the deployment process on the server
# Usage: ./deploy.sh [environment]
# Example: ./deploy.sh production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_HOST="root@172.16.0.189"
SERVER_DIR="/root/proofpoint-dashboard"
APP_CONTAINER="proofpoint-app"
DB_CONTAINER="proofpoint-db"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if sshpass is installed
check_dependencies() {
    log_info "Checking dependencies..."
    if ! command -v sshpass &> /dev/null; then
        log_error "sshpass is not installed. Install it with:"
        log_error "  macOS: brew install sshpass"
        log_error "  Ubuntu/Debian: sudo apt-get install sshpass"
        exit 1
    fi
    log_info "Dependencies OK ✓"
}

# Backup database before deployment
backup_database() {
    log_info "Creating database backup..."

    local backup_file="/tmp/proofpoint_backup_$(date +%Y%m%d_%H%M%S).sql"

    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "docker exec $DB_CONTAINER pg_dump -U proofpoint proofpoint > $backup_file"

    log_info "Database backed up to: $backup_file on server"
}

# Deploy to server
deploy_to_server() {
    log_info "Deploying to server..."

    # Stop the app container
    log_info "Stopping application container..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && docker-compose stop app"

    # Pull latest code
    log_info "Pulling latest code..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && git pull origin main"

    # Install dependencies
    log_info "Installing dependencies..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && npm install"

    # Generate Prisma Client
    log_info "Generating Prisma Client..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && npm run db:generate"

    # Apply any pending database migrations
    log_info "Applying database migrations..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && npm run db:migrate:deploy"

    # Build the application
    log_info "Building application..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && npm run build"

    # Restart the app container
    log_info "Starting application container..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && docker-compose up -d app"

    # Wait for app to be healthy
    log_info "Waiting for application to start..."
    sleep 10

    # Check container status
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "docker ps --filter name=$APP_CONTAINER --format '{{.Status}}'"

    log_info "Deployment completed successfully! ✓"
}

# Rollback function
rollback() {
    log_error "Deployment failed! Rolling back..."
    sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
        "cd $SERVER_DIR && git reset --hard HEAD@{1} && docker-compose restart app"
    log_info "Rollback completed"
}

# Main deployment flow
main() {
    log_info "Starting ProofPoint Dashboard deployment..."
    echo ""

    check_dependencies
    backup_database
    deploy_to_server

    echo ""
    log_info "Deployment finished successfully! 🚀"
    log_info "Application should be available at: http://172.16.0.189:3060"
}

# Run main function
main
