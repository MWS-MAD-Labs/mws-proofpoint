# Production Database Fix Guide - Director Assignment Issue

## Problem
The download report shows "Director Name" placeholder instead of the actual director name because existing assessments don't have a `director_id` assigned in the database.

## Solution
Run the provided SQL migration script to assign the director to all existing assessments.

---

## Step-by-Step Instructions

### Option 1: SSH into Production Server (Recommended)

#### 1. SSH into your production server
```bash
ssh user@your-production-server
```

#### 2. Navigate to your project directory
```bash
cd /path/to/ProofPoint-Dashboard
```

#### 3. Connect to the PostgreSQL database
Find the container name:
```bash
docker ps | grep postgres
```

Connect to the database:
```bash
docker exec -it proofpoint-db psql -U proofpoint -d proofpoint
```

#### 4. Run the migration
Copy and paste the SQL commands from `database/migrations/012_fix_director_assignment.sql` or run:

```sql
-- Check current state
SELECT
    COUNT(*) as total_assessments,
    COUNT(director_id) as with_director,
    COUNT(*) - COUNT(director_id) as without_director
FROM assessments;

-- Update all assessments to assign director
UPDATE assessments
SET director_id = (
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON ur.user_id = p.user_id
    WHERE ur.role = 'director'
    LIMIT 1
)
WHERE director_id IS NULL;

-- Verify the update
SELECT
    COUNT(*) as total_assessments,
    COUNT(director_id) as with_director
FROM assessments;
```

#### 5. Exit the database
```bash
\q
```

#### 6. Verify the fix works
Open your production site and try downloading a report. It should now show the director's name.

---

### Option 2: Run SQL Script via Docker Exec

#### 1. Copy the migration file to the server
```bash
scp database/migrations/012_fix_director_assignment.sql user@server:/tmp/
```

#### 2. SSH into the server and execute the script
```bash
ssh user@server
docker exec -i proofpoint-db psql -U proofpoint -d proofpoint < /tmp/012_fix_director_assignment.sql
```

---

### Option 3: Using Adminer or Database Management UI

If you have Adminer or phpPgAdmin installed:

#### 1. Access the database UI
- Adminer: `http://your-server:port/adminer`
- Or your preferred database management tool

#### 2. Login with credentials from your `.env` file
```
Host: localhost (or the database host)
User: proofpoint
Password: (from POSTGRES_PASSWORD in .env)
Database: proofpoint
```

#### 3. Execute the SQL
Open the SQL query window and paste the contents of `database/migrations/012_fix_director_assignment.sql`

---

## Verification Steps

After running the migration, verify it worked:

### 1. Check that all assessments have a director
```sql
SELECT COUNT(*) as total, COUNT(director_id) as with_director
FROM assessments;
```
Both numbers should be the same.

### 2. Check a sample assessment
```sql
SELECT
    a.id,
    sp.full_name as staff_name,
    dp.full_name as director_name,
    dp.job_title as director_job_title
FROM assessments a
LEFT JOIN profiles sp ON a.staff_id = sp.user_id
LEFT JOIN profiles dp ON a.director_id = dp.user_id
LIMIT 3;
```

You should see actual director names (e.g., "Mahrukh Bashir").

### 3. Test in the application
- Open your production site: `https://proof.mws.web.id`
- Navigate to Manager or Director dashboard
- Click "Download Report" on any assessment
- Verify the signature section shows the actual director name

---

## Rollback (If Needed)

If something goes wrong, you can rollback:
```sql
UPDATE assessments SET director_id = NULL WHERE 1=1;
```

---

## Code Deployment

After fixing the database, deploy the code changes to prevent this issue in the future:

```bash
# Pull the latest code with the auto-assignment fix
git pull origin main

# Rebuild and restart the containers
docker-compose down
docker-compose up -d --build

# Check logs
docker-compose logs -f app
```

---

## What the Code Fix Does

The updated `/src/app/api/assessments/route.ts` now automatically assigns the director when creating new assessments:

- If `director_id` is not provided during assessment creation
- It queries the `user_roles` table to find the user with "director" role
- Automatically assigns that director to the new assessment

This ensures all future assessments will have a director assigned by default.

---

## Safety Notes

✅ **This migration is SAFE:**
- Only updates NULL director_id values
- Doesn't delete any existing data
- Can be easily rolled back if needed
- Uses database transactions for consistency

⚠️ **Before running on production:**
- Backup your database first (optional but recommended)
- Test on staging/local environment first
- Run during low-traffic period if possible

---

## Need Help?

If you encounter any issues:
1. Check Docker logs: `docker-compose logs postgres`
2. Check application logs: `docker-compose logs app`
3. Verify database connectivity: `docker exec proofpoint-db pg_isready -U proofpoint`
