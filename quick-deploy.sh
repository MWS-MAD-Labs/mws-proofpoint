#!/bin/bash

# =====================================================
# Quick Deploy Script (Fast deployment)
# =====================================================
# Use this for quick updates without full rebuild
# Usage: ./quick-deploy.sh

set -e

SERVER_HOST="root@172.16.0.189"
SERVER_DIR="/root/proofpoint-dashboard"

echo "Quick Deploy - Pulling and Restarting..."
echo ""

# Pull latest code
sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
    "cd $SERVER_DIR && git pull origin main"

# Generate Prisma Client (if schema changed)
sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
    "cd $SERVER_DIR && npm run db:generate"

# Apply migrations
sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
    "cd $SERVER_DIR && npm run db:migrate:deploy"

# Restart without rebuild
sshpass -p 'root' ssh -o StrictHostKeyChecking=no "$SERVER_HOST" \
    "cd $SERVER_DIR && docker-compose restart app"

echo ""
echo "Quick deploy completed! ✓"
echo "Application restarting at: http://172.16.0.189:3060"
