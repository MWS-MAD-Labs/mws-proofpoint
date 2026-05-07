# CI/CD Pipeline Documentation

Complete guide for the ProofPoint Dashboard continuous integration and deployment pipeline.

## Overview

The CI/CD pipeline uses GitHub Actions to:
1. **Test** - Validate code and build application
2. **Build** - Create Docker image and push to GitHub Container Registry (GHCR)
3. **Deploy** - Trigger Komodo webhook to pull image and restart services

## Architecture

```
┌─────────────┐
│ Push to main│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   GitHub Actions (CI/CD)            │
│                                     │
│  ┌──────────┐   ┌─────────────┐   │
│  │  Test    │ → │ Build Image │   │
│  │  Build   │   │ Push GHCR   │   │
│  └──────────┘   └──────┬──────┘   │
│                       │            │
│                       ▼            │
│              ┌──────────────┐     │
│              │ Redeploy     │     │
│              │ Webhook Call │     │
│              └──────┬───────┘     │
└─────────────────────┼─────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Komodo Server  │
            │                 │
            │ • Pull Image    │
            │ • Run Migrations│
            │ • Restart App   │
            └─────────────────┘
```

## GitHub Actions Workflow

### Jobs

#### 1. Test Job
Validates that the application builds successfully:
- Checkout code
- Setup Node.js 20
- Install dependencies (`npm ci`)
- Generate Prisma Client
- Build Next.js application

#### 2. Build & Push Job
Creates and pushes Docker image to GHCR:
- Login to GitHub Container Registry
- Extract metadata (tags: `latest`, `sha-<commit>`)
- Build multi-stage Docker image
- Push to `ghcr.io/faisalnh/proofpoint-dashboard`

#### 3. Redeploy Job
Triggers deployment on Komodo server:
- Only runs on `main` branch
- Sends webhook to Komodo with HMAC signature
- Komodo pulls new image and restarts services

### Workflow File

Located at: `.github/workflows/deploy.yml`

## Required GitHub Secrets

Configure at: https://github.com/faisalnh/proofpoint-dashboard/settings/secrets/actions

| Secret | Required | Description | Example |
|--------|----------|-------------|---------|
| `KOMODO_WEBHOOK_URL` | Yes | Komodo webhook endpoint | `http://komodo-server.com/webhook/deploy` |
| `KOMODO_WEBHOOK_SECRET` | Yes | HMAC signature secret | `random-secret-key` |
| `DATABASE_URL` | Yes | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Yes | Application URL | `http://172.16.0.189:3060` |
| `NEXTAUTH_SECRET` | Yes | NextAuth secret | `your-secret-key` |

## Docker Images

### Image Tags
Each build creates two tags:
- `ghcr.io/faisalnh/proofpoint-dashboard:latest` - Latest version
- `ghcr.io/faisalnh/proofpoint-dashboard:sha-<commit>` - Specific commit

### Multi-Stage Build
**Stage 1 (Builder):**
- Node.js 20 Alpine
- Install dependencies
- Generate Prisma Client
- Build Next.js application

**Stage 2 (Runner):**
- Minimal Node.js 20 Alpine
- Copy built artifacts
- Production runtime only

### Image Size
~150-200MB (optimized with multi-stage build)

## Komodo Deployment

### Webhook Payload

GitHub Actions sends a signed POST request:

```json
{
  "event": "push",
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "faisalnh/proofpoint-dashboard"
  }
}
```

### Webhook Authentication

Request includes HMAC SHA256 signature:
```
X-Hub-Signature-256: sha256=<signature>
X-GitHub-Event: push
Content-Type: application/json
```

### Komodo Server Script

The webhook handler should:

1. **Verify Signature**
   ```bash
   RECEIVED_SIGNATURE=$(echo "$HEADER_X_HUB_SIGNATURE_256" | sed 's/sha256=//')
   CALCULATED_SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')
   
   if [ "$RECEIVED_SIGNATURE" != "$CALCULATED_SIGNATURE" ]; then
     echo "Invalid signature"
     exit 1
   fi
   ```

2. **Pull Latest Code**
   ```bash
   cd /root/proofpoint-dashboard
   git pull origin main
   ```

3. **Pull New Docker Image**
   ```bash
   docker pull ghcr.io/faisalnh/proofpoint-dashboard:latest
   ```

4. **Run Database Migrations**
   ```bash
   npm ci
   npm run db:generate
   npm run db:migrate:deploy
   ```

5. **Restart Services**
   ```bash
   docker-compose up -d app
   ```

See: `scripts/komodo-deploy.sh`

## Database Migrations

Prisma migrations run automatically during deployment:

### Creating Migrations
```bash
# After modifying prisma/schema.prisma
npm run db:migrate:dev --name describe_change

# Test locally
npm run db:push

# Commit and push
git add prisma/migrations/
git commit -m "Add migration: describe_change"
git push origin main
```

### Migration Flow

```
Push to main
  ↓
GitHub Actions builds Docker image
  ↓
Komodo webhook triggers
  ↓
Komodo server runs: npm run db:migrate:deploy
  ↓
Database schema updated ✅
```

## Deployment Process

### Automatic Deployment (Recommended)

```bash
# Make changes
git add .
git commit -m "Your feature"
git push origin main
```

**What happens:**
1. GitHub Actions starts automatically
2. Test job validates build (~2 min)
3. Build job creates Docker image (~3 min)
4. Deploy job triggers webhook (~10 sec)
5. Komodo server deploys (~2 min)

**Total time:** ~7-8 minutes

### Manual Deployment Options

#### Option 1: Trigger Workflow Manually
1. Go to Actions tab in GitHub
2. Select "CI/CD Pipeline"
3. Click "Run workflow"
4. Select branch and click "Run workflow"

#### Option 2: Deploy on Server
```bash
ssh root@komodo-server
cd /root/proofpoint-dashboard
./scripts/komodo-deploy.sh
```

#### Option 3: Quick Deploy (No Rebuild)
For small changes (env vars, config):
```bash
./quick-deploy.sh
```

## Monitoring Deployments

### GitHub Actions

**View Status:**
- https://github.com/faisalnh/proofpoint-dashboard/actions

**Workflow Runs:**
- Green checkmark = Success
- Red X = Failure
- Yellow dot = In progress

**Logs:**
- Click on a workflow run
- Click on a job to see detailed logs
- Expand steps to see output

### Server Monitoring

```bash
# Application logs
ssh root@komodo-server 'docker logs proofpoint-app -f'

# Container status
ssh root@komodo-server 'docker ps --filter name=proofpoint'

# Health check
curl http://komodo-server:3060
```

## Troubleshooting

### Build Failures

**Issue:** Build job fails

**Solutions:**
1. Check build logs in GitHub Actions
2. Look for TypeScript/ESLint errors
3. Verify all dependencies are available
4. Check Prisma schema is valid

**Common fixes:**
- Run `npm ci` locally to test install
- Run `npm run build` locally to test build
- Check `DATABASE_URL` is set correctly

### Deployment Failures

**Issue:** Deploy job fails

**Solutions:**
1. Check `KOMODO_WEBHOOK_URL` is set correctly
2. Verify webhook endpoint is accessible
3. Check Komodo server logs
4. Verify webhook secret matches

**Test webhook locally:**
```bash
PAYLOAD='{"event":"push","ref":"refs/heads/main","repository":{"full_name":"faisalnh/proofpoint-dashboard"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD" \
  "$WEBHOOK_URL"
```

### Migration Failures

**Issue:** Database migration fails on server

**Solutions:**
```bash
# Check migration status
ssh root@komodo-server
cd /root/proofpoint-dashboard
npx prisma migrate status

# Resolve failed migration
npx prisma migrate resolve --rolled-back [migration-name]

# Re-run deployment
npm run db:migrate:deploy
```

### Container Won't Start

**Issue:** Docker container fails after deployment

**Solutions:**
```bash
# Check logs
docker logs proofpoint-app --tail 100

# Check container status
docker ps -a

# Restart manually
docker-compose restart app

# Rollback to previous image
# Edit docker-compose.yml with previous tag
docker-compose up -d app
```

## Best Practices

1. **Test Locally First**
   ```bash
   npm run build
   npm run db:migrate:dev --name test
   ```

2. **Small, Frequent Commits**
   - Easier to debug issues
   - Faster rollbacks
   - Less merge conflicts

3. **Keep Secrets Secure**
   - Never commit secrets to git
   - Rotate webhook secrets regularly
   - Use strong, random secrets

4. **Monitor After Deployments**
   - Check GitHub Actions status
   - Verify application is accessible
   - Monitor error logs for 10 minutes

5. **Database Backups**
   - Automatic backup before each deployment
   - Backups stored in `/tmp/` on server
   - Keep off-site backups for critical data

## Rollback Procedure

### Rollback to Previous Version

**Option 1: GitHub UI**
1. Go to Actions tab
2. Find previous successful workflow
3. Re-run that workflow

**Option 2: Manual Rollback on Server**
```bash
ssh root@komodo-server
cd /root/proofpoint-dashboard

# Checkout previous commit
git log --oneline -5
git reset --hard <previous-sha>

# Deploy previous version
./scripts/komodo-deploy.sh
```

**Option 3: Rollback Docker Image**
```bash
# List available images
docker images | grep proofpoint-dashboard

# Update docker-compose.yml with previous tag
vim docker-compose.yml

# Restart with previous image
docker-compose up -d app
```

## Environment Variables

### Development (.env.local)
```env
DATABASE_URL=postgresql://proofpoint:password@localhost:5432/proofpoint
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-key
```

### Production (GitHub Secrets)
```env
DATABASE_URL=postgresql://proofpoint:password@db:5432/proofpoint
NEXTAUTH_URL=http://172.16.0.189:3060
NEXTAUTH_SECRET=<production-secret-key>
```

## URLs

- **Application:** http://172.16.0.189:3060
- **GitHub Actions:** https://github.com/faisalnh/proofpoint-dashboard/actions
- **Docker Registry:** https://github.com/faisalnh/proofpoint-dashboard/pkgs/container/proofpoint-dashboard
- **Secrets Configuration:** https://github.com/faisalnh/proofpoint-dashboard/settings/secrets/actions

## Support

### Documentation
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Docker Docs](https://docs.docker.com/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### Common Commands

```bash
# Local development
npm run dev

# Build locally
npm run build

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate:dev --name description

# Push to production
git push origin main

# Check deployment
# Go to: https://github.com/faisalnh/proofpoint-dashboard/actions
```

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-18 | Initial CI/CD setup with Docker + Komodo webhook | Faisal |
| 2026-02-18 | Match Exim-Accurate pattern with HMAC signature | Faisal |

---

**Last Updated:** 2026-02-18
