# GitHub Secrets Setup

## Required Secrets for Deployment

Add these secrets to your GitHub repository:

**Go to:** https://github.com/faisalnh/proofpoint-dashboard/settings/secrets/actions

### Required Secrets

| Secret Name | Description | Example |
|------------|-------------|---------|
| `KOMODO_WEBHOOK_URL` | Komodo webhook endpoint URL | `http://your-komodo-server.com/webhook/deploy` |
| `KOMODO_WEBHOOK_SECRET` | Webhook secret for HMAC signature | `your-secret-key` |
| `DATABASE_URL` | Database connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Application URL | `http://your-server.com:3060` |
| `NEXTAUTH_SECRET` | NextAuth secret key | `your-secret-key` |

## Workflow Steps

1. **Test & Build** - Run tests and build Next.js app
2. **Build & Push** - Build Docker image and push to GHCR
3. **Redeploy** - Trigger Komodo webhook with HMAC signature

## Webhook Payload

The webhook sends a minimal GitHub push event payload:
```json
{
  "event": "push",
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "faisalnh/proofpoint-dashboard"
  }
}
```

## On Komodo Server

Your webhook receiver should:

1. Verify HMAC signature in `X-Hub-Signature-256` header
2. Pull the latest Docker image from GHCR
3. Run Prisma migrations
4. Restart the container

This matches the Exim-Accurate deployment pattern.
