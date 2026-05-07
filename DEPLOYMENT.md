# Deployment Guide (Komodo + Docker)

This guide covers the Docker-based deployment workflow for ProofPoint Dashboard using GitHub Actions and Komodo webhook.

## Deployment Architecture

```
GitHub Push
  ↓
GitHub Actions (CI)
  ├─ Build Docker image
  ├─ Push to GHCR (GitHub Container Registry)
  └─ Trigger Komodo webhook
  ↓
Komodo Server (CD)
  ├─ Pull new Docker image
  ├─ Backup database
  ├─ Run Prisma migrations
  ├─ Update container
  └─ Health check
```

## Prerequisites

### GitHub Secrets

Configure these in your repository → **Settings** → **Secrets and variables** → **Actions**:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `GITHUB_TOKEN` | GitHub token (auto-provided) | `***` |
| `KOMODO_HOST` | Komodo server IP | `172.16.0.189` |
| `KOMODO_USER` | SSH username | `root` |
| `KOMODO_PASSWORD` | SSH password | `your_password` |
| `KOMODO_WEBHOOK_URL` | Webhook endpoint | `http://komodo-server/deploy` |
| `DATABASE_URL` | Database connection | `postgresql://...` |
| `NEXTAUTH_URL` | Application URL | `http://172.16.0.189:3060` |
| `NEXTAUTH_SECRET` | Auth secret key | `your_secret_key` |

### Server Setup

On the Komodo server (172.16.0.189):

```bash
# 1. Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 2. Clone repository
cd /root
git clone https://github.com/faisalnh/proofpoint-dashboard.git
cd proofpoint-dashboard

# 3. Make scripts executable
chmod +x scripts/komodo-deploy.sh
chmod +x scripts/server-deploy.sh

# 4. Create environment file
cat > .env << EOF
DATABASE_URL=postgresql://proofpoint:UgQp4XEDDFsbpRZYkhEEdMXP@db:5432/proofpoint
NEXTAUTH_URL=http://172.16.0.189:3060
NEXTAUTH_SECRET=your-secret-key-here
GITHUB_USERNAME=your-github-username
GITHUB_TOKEN=your-github-token
EOF

# 5. Start containers
docker-compose up -d
```

## Dockerfile

The application is containerized with a multi-stage Dockerfile:

- **Stage 1 (builder):** Builds Next.js app and generates Prisma Client
- **Stage 2 (runner):** Minimal production image with built artifacts

## Deployment Workflow

### Automatic Deployment (Push to Main)

```bash
git add .
git commit -m "Your changes"
git push origin main
```

**What happens:**

1. **GitHub Actions:**
   ```yaml
   - Build Docker image
   - Push to ghcr.io/faisalnh/proofpoint-dashboard:latest
   - Push to ghcr.io/faisalnh/proofpoint-dashboard:<commit-sha>
   - Trigger Komodo webhook
   ```

2. **Komodo Server:**
   ```bash
   - Backup database
   - Pull latest code
   - Login to GHCR
   - Pull new Docker image
   - Apply Prisma migrations
   - Update docker-compose.yml
   - Restart container
   - Health check
   ```

### Manual Deployment

#### Option 1: Build and Deploy Locally

```bash
# Build image
docker build -t proofpoint-dashboard .

# Tag for GHCR
docker tag proofpoint-dashboard ghcr.io/faisalnh/proofpoint-dashboard:latest

# Push to GHCR
docker push ghcr.io/faisalnh/proofpoint-dashboard:latest

# SSH to server and trigger deployment
ssh root@172.16.0.189
cd /root/proofpoint-dashboard
./scripts/komodo-deploy.sh ghcr.io/faisalnh/proofpoint-dashboard:latest
```

#### Option 2: Direct Server Deployment

```bash
ssh root@172.16.0.189
cd /root/proofpoint-dashboard
./scripts/server-deploy.sh
```

## Database Migrations

### Creating a Migration

```bash
# After modifying prisma/schema.prisma
npm run db:migrate:dev --name describe_changes

# Test migration locally
npm run db:push

# Commit migration
git add prisma/migrations/
git commit -m "Add migration: describe_changes"
git push origin main
```

Migrations run **automatically** during deployment on the server!

### Manual Migration

```bash
ssh root@172.16.0.189
cd /root/proofpoint-dashboard
npm run db:migrate:deploy
```

## Docker Commands

### View Logs

```bash
# Application logs
docker logs proofpoint-app -f

# Last 100 lines
docker logs proofpoint-app --tail 100

# Database logs
docker logs proofpoint-db -f
```

### Container Management

```bash
# Check status
docker ps

# Restart container
docker restart proofpoint-app

# Stop container
docker stop proofpoint-app

# Start container
docker start proofpoint-app

# Rebuild and restart
docker-compose up -d --build app
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it proofpoint-db psql -U proofpoint -d proofpoint

# Backup database
docker exec proofpoint-db pg_dump -U proofpoint proofpoint > backup.sql

# Restore database
docker exec -i proofpoint-db psql -U proofpoint proofpoint < backup.sql
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs proofpoint-app

# Check container status
docker ps -a

# Inspect container
docker inspect proofpoint-app
```

### Database Connection Issues

```bash
# Check if database is running
docker ps | grep proofpoint-db

# Test connection
docker exec proofpoint-app ping -c 3 db

# Check database logs
docker logs proofpoint-db
```

### Rollback to Previous Image

```bash
ssh root@172.16.0.189
cd /root/proofpoint-dashboard

# List available images
docker images | grep proofpoint-dashboard

# Update docker-compose.yml with previous image tag
vim docker-compose.yml

# Restart with previous image
docker-compose up -d app
```

### Migration Failed

```bash
ssh root@172.16.0.189
cd /root/proofpoint-dashboard

# Check migration status
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --rolled-back [migration-name]

# Re-run migration
npm run db:migrate:deploy
```

## Monitoring

### Health Checks

```bash
# HTTP check
curl http://172.16.0.189:3060

# Container health
ssh root@172.16.0.189 'docker ps --filter name=proofpoint'

# Docker stats
ssh root@172.16.0.189 'docker stats proofpoint-app'
```

### View Deployment History

```bash
# GitHub Actions
# Go to: https://github.com/faisalnh/proofpoint-dashboard/actions

# Server logs
ssh root@172.16.0.189 'docker logs proofpoint-app --tail 100'
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Application URL | `http://172.16.0.189:3060` |
| `NEXTAUTH_SECRET` | NextAuth secret | Random string |
| `NODE_ENV` | Environment | `production` |

### Updating Environment Variables

```bash
ssh root@172.16.0.189
cd /root/proofpoint-dashboard

# Edit .env file
vim .env

# Restart container to apply
docker-compose restart app
```

## Security Best Practices

1. **Use GitHub Secrets** for sensitive data
2. **Rotate secrets** regularly
3. **Use specific image tags** in production (not just `latest`)
4. **Keep backups** before major deployments
5. **Monitor logs** for suspicious activity
6. **Use SSH keys** instead of passwords
7. **Enable HTTPS** with reverse proxy (nginx)
8. **Scan images** for vulnerabilities: `docker scan proofpoint-dashboard`

## Performance Optimization

1. **Use BuildKit** for faster builds
2. **Layer caching** in Dockerfile
3. **Multi-stage builds** to reduce image size
4. **.dockerignore** to exclude unnecessary files
5. **Image pruning** to free disk space: `docker image prune -a`

## Disaster Recovery

### Backup Strategy

```bash
# Automated backup (in deployment script)
docker exec proofpoint-db pg_dump -U proofpoint proofpoint > backup.sql

# Off-site backup
scp backup.sql backup-server:/backups/proofpoint_$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
# Stop application
docker-compose stop app

# Restore database
docker exec -i proofpoint-db psql -U proofpoint proofpoint < backup.sql

# Restart application
docker-compose start app
```

## URLs

- **Application:** http://172.16.0.189:3060
- **GitHub:** https://github.com/faisalnh/proofpoint-dashboard
- **GitHub Actions:** https://github.com/faisalnh/proofpoint-dashboard/actions
- **Docker Registry:** https://github.com/faisalnh/proofpoint-dashboard/pkgs/container/proofpoint-dashboard

## Support

For issues:
1. Check GitHub Actions logs
2. Check Docker logs: `docker logs proofpoint-app`
3. Review this documentation
4. Check Prisma docs: https://www.prisma.io/docs
