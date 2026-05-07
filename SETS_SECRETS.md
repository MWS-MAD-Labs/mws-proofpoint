# GitHub Secrets Setup Guide

To make the deployment work, you need to configure these secrets in your GitHub repository.

## Required Secrets

Go to: https://github.com/faisalnh/proofpoint-dashboard/settings/secrets/actions

And add the following secrets:

### 1. KOMODO_HOST
Your Komodo server IP address
```
172.16.0.189
```

### 2. KOMODO_USER
SSH username for Komodo server
```
root
```

### 3. KOMODO_PASSWORD
SSH password for Komodo server
```
your_password_here
```

### 4. KOMODO_WEBHOOK_URL
The webhook URL that triggers deployment on Komodo
```
http://172.16.0.189:3000/deploy
```
(Note: You need to set up a webhook receiver on your Komodo server)

### 5. DATABASE_URL (if not already set)
Database connection string
```
postgresql://proofpoint:UgQp4XEDDFsbpRZYkhEEdMXP@localhost:5432/proofpoint
```

### 6. NEXTAUTH_URL (if not already set)
Application URL
```
http://172.16.0.189:3060
```

### 7. NEXTAUTH_SECRET (if not already set)
Your NextAuth secret key
```
your_secret_key_here
```

## Quick Setup

1. Open GitHub repository settings
2. Go to Secrets and variables → Actions
3. Click "New repository secret" for each secret above
4. Paste the value and click "Add secret"

## Optional: Use GitHub CLI

If you have `gh` CLI installed:

```bash
gh secret set KOMODO_HOST --body "172.16.0.189"
gh secret set KOMODO_USER --body "root"
gh secret set KOMODO_PASSWORD --body "your_password"
gh secret set KOMODO_WEBHOOK_URL --body "http://172.16.0.189:3000/deploy"
```
