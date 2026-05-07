# Production Deployment Guide - Prisma Migration

## Overview
This guide will help you deploy the director assignment fix to production using Prisma migrations.

---

## Pre-Deployment Checklist

✅ Verify the migration locally first
✅ Backup production database (optional but recommended)
✅ Ensure you have access to the production server
✅ Have your database credentials ready

---

## Step 1: Test Migration Locally

Before deploying to production, test the migration on your local database:

```bash
# 1. Check current state (should show NULL director_id)
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "
  SELECT COUNT(*) as total, COUNT(director_id) as with_director
  FROM assessments;
"

# 2. Apply the migration
npx prisma migrate deploy

# 3. Verify the fix
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "
  SELECT
    a.id,
    sp.full_name as staff_name,
    dp.full_name as director_name
  FROM assessments a
  LEFT JOIN profiles sp ON a.staff_id = sp.user_id
  LEFT JOIN profiles dp ON a.director_id = dp.user_id
  LIMIT 3;
"
```

---

## Step 2: Deploy Code to Production

### Option A: Pull and Deploy on Server

SSH into your production server:

```bash
ssh user@your-production-server
cd /path/to/ProofPoint-Dashboard

# Pull latest code
git pull origin main

# Build and restart containers
docker-compose down
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### Option B: Deploy via CI/CD

If you're using GitHub Actions or similar:

```bash
# Push changes
git add .
git commit -m "fix: assign director to existing assessments"
git push origin main
```

Your CI/CD pipeline should handle the deployment automatically.

---

## Step 3: Apply Prisma Migration on Production

After the code is deployed, apply the migration:

### Option A: Via Docker Exec

```bash
# SSH into production server
ssh user@your-production-server
cd /path/to/ProofPoint-Dashboard

# Apply Prisma migrations
docker-compose exec app npx prisma migrate deploy
```

### Option B: Via Prisma CLI Directly

If you have Prisma CLI installed on the server:

```bash
# Set database URL
export DATABASE_URL="postgresql://proofpoint:password@localhost:5432/proofpoint"

# Apply migrations
npx prisma migrate deploy
```

---

## Step 4: Verify the Migration

After applying the migration, verify it worked:

```bash
# Check that all assessments now have a director
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "
  SELECT
    COUNT(*) as total_assessments,
    COUNT(director_id) as with_director,
    COUNT(*) - COUNT(director_id) as without_director
  FROM assessments;
"

# Sample query to see director names
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "
  SELECT
    a.id,
    sp.full_name as staff_name,
    dp.full_name as director_name,
    dp.job_title as director_job_title
  FROM assessments a
  LEFT JOIN profiles sp ON a.staff_id = sp.user_id
  LEFT JOIN profiles dp ON a.director_id = dp.user_id
  ORDER BY a.created_at DESC
  LIMIT 5;
"
```

Expected result: `total_assessments` should equal `with_director`

---

## Step 5: Test in Application

1. Open your production site: `https://proof.mws.web.id`
2. Login as Manager or Director
3. Navigate to any assessment
4. Click "Download Report"
5. Verify the signature section shows the actual director name (e.g., "Mahrukh Bashir")

---

## Troubleshooting

### Migration fails to apply

```bash
# Check migration status
docker-compose exec app npx prisma migrate status

# View migration history
docker-compose exec app npx prisma migrate status
```

### Database connection issues

```bash
# Check database container is running
docker ps | grep postgres

# Test database connection
docker exec proofpoint-db pg_isready -U proofpoint
```

### Rollback (if needed)

If something goes wrong, you can rollback manually:

```sql
-- Connect to database
docker exec -it proofpoint-db psql -U proofpoint -d proofpoint

-- Rollback the migration
UPDATE assessments SET director_id = NULL WHERE director_id IS NOT NULL;

-- Exit
\q
```

Then mark the migration as rolled back:

```bash
docker-compose exec app npx prisma migrate resolve --rolled-back 20260222100000_fix_director_assignment
```

---

## What This Migration Does

The migration file `20260222100000_fix_director_assignment/migration.sql`:

1. ✅ Finds all assessments with NULL `director_id`
2. ✅ Queries the `user_roles` table for the first user with role 'director'
3. ✅ Updates those assessments to assign the director
4. ✅ Safe to run multiple times (idempotent)

---

## Code Changes Included

The deployment also includes the API fix in `/src/app/api/assessments/route.ts`:

- **Before**: New assessments were created with `director_id = null`
- **After**: New assessments automatically get the director assigned if not provided

This prevents the issue from happening again in the future.

---

## Post-Deployment Notes

✅ All existing assessments now have a director assigned
✅ Download reports show actual director names
✅ Future assessments auto-assign the director
✅ No data loss or schema changes
✅ Migration is idempotent (safe to re-run)

---

## Next Steps

1. Monitor the application logs for any errors
2. Test the download report functionality
3. Verify email notifications still work (if enabled)
4. Check that new assessments can be created successfully

---

## Need Help?

Check the logs:
```bash
docker-compose logs app
docker-compose logs postgres
```

View recent migrations:
```bash
docker-compose exec app npx prisma migrate status
```
