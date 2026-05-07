# Database Migration Guide

This guide provides instructions for applying database migrations to the ProofPoint Dashboard database on the production server.

## Server Information

- **Server IP:** 172.16.0.189
- **SSH User:** root
- **SSH Password:** root
- **Database Container:** proofpoint-db
- **Database Name:** proofpoint
- **Database User:** proofpoint
- **Database Password:** UgQp4XEDDFsbpRZYkhEEdMXP

## Prerequisites

Before running migrations, ensure you have:
- `sshpass` installed on your local machine (for SSH password authentication)
- SSH access to the production server
- The migration SQL files ready in the `database/migrations/` directory

### Installing sshpass

```bash
# macOS
brew install sshpass

# Ubuntu/Debian
sudo apt-get install sshpass

# RHEL/CentOS
sudo yum install sshpass
```

## Migration Process

### Step 1: Connect to Server and Identify Database

First, verify the database container and connection details:

```bash
# SSH to server and check running PostgreSQL containers
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 'docker ps | grep postgres'

# Check database environment variables
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 'docker exec proofpoint-db env | grep -i postgres'
```

Expected output:
```
POSTGRES_DB=proofpoint
POSTGRES_USER=proofpoint
POSTGRES_PASSWORD=UgQp4XEDDFsbpRZYkhEEdMXP
```

### Step 2: Copy Migration Files to Server

Copy your SQL migration files from local machine to the server:

```bash
# Copy migration file(s) to server's /tmp directory
sshpass -p 'root' scp -o StrictHostKeyChecking=no database/migrations/YOUR_MIGRATION.sql root@172.16.0.189:/tmp/
```

### Step 3: Apply Migrations

Execute the migration inside the Docker container:

```bash
# Copy file into container and execute migration
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
  'docker cp /tmp/YOUR_MIGRATION.sql proofpoint-db:/tmp/ && \
   docker exec proofpoint-db psql -U proofpoint -d proofpoint -f /tmp/YOUR_MIGRATION.sql'
```

### Step 4: Verify Migration

Verify the migration was successful:

```bash
# Connect to database and check tables
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
  'docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "\dt"'
```

## Example: Applying Multiple Migrations

Here's a complete example of applying two migration files (007 and 008):

```bash
# Copy both files to server
sshpass -p 'root' scp -o StrictHostKeyChecking=no \
  database/migrations/007_performance_tracker.sql \
  database/migrations/008_work_log_dashboard.sql \
  root@172.16.0.189:/tmp/

# Apply first migration
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
  'docker cp /tmp/007_performance_tracker.sql proofpoint-db:/tmp/ && \
   docker exec proofpoint-db psql -U proofpoint -d proofpoint -f /tmp/007_performance_tracker.sql'

# Apply second migration
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
  'docker cp /tmp/008_work_log_dashboard.sql proofpoint-db:/tmp/ && \
   docker exec proofpoint-db psql -U proofpoint -d proofpoint -f /tmp/008_work_log_dashboard.sql'
```

## Recent Migrations Applied

### 2026-01-21: Performance Tracker and Work Log

**Applied migrations:**
- `007_performance_tracker.sql` - Performance tracking tables
- `008_work_log_dashboard.sql` - Work log and task management tables

**Tables created:**

From `007_performance_tracker.sql`:
- `public.performance_entries` - User KPI progress tracking entries
- `public.performance_artifacts` - Files and links attached to performance entries

From `008_work_log_dashboard.sql`:
- `public.work_tasks` - Main work task tracking
- `public.work_subtasks` - Task checklist items
- `public.work_task_kpis` - Many-to-many linking tasks to KPIs
- Modified `public.performance_artifacts` - Added `task_id` column for task artifact linking

**Migration output:**
```
# 007_performance_tracker.sql
CREATE TABLE
CREATE TABLE
CREATE INDEX (5 indexes)
CREATE TRIGGER

# 008_work_log_dashboard.sql
CREATE TABLE (3 tables)
DO
CREATE INDEX (8 indexes)
CREATE TRIGGER
```

## Troubleshooting

### Issue: "psql: command not found"

This means psql is not in the system PATH. Use the Docker container instead:

```bash
docker exec proofpoint-db psql -U proofpoint -d proofpoint -f /path/to/migration.sql
```

### Issue: "role 'postgres' does not exist"

The database uses a custom user. Always use `-U proofpoint` instead of `-U postgres`.

### Issue: Permission denied

Ensure you're using the correct SSH password and have root access to the server.

### Issue: Migration fails with "relation already exists"

The migration may have already been applied. Check if tables exist:

```bash
sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
  'docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "\d+ TABLE_NAME"'
```

## Best Practices

1. **Always backup before migrations:**
   ```bash
   sshpass -p 'root' ssh -o StrictHostKeyChecking=no root@172.16.0.189 \
     'docker exec proofpoint-db pg_dump -U proofpoint proofpoint > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql'
   ```

2. **Test migrations locally first** using a copy of production data

3. **Use idempotent migrations** with `CREATE TABLE IF NOT EXISTS` and similar commands

4. **Document each migration** in this file with:
   - Date applied
   - Migration file name
   - What changed
   - Any special considerations

5. **Version your migrations** using sequential numbers (001_, 002_, etc.)

6. **Keep migration files immutable** - never edit applied migrations, create new ones instead

## Quick Reference Commands

```bash
# List all databases
docker exec proofpoint-db psql -U proofpoint -l

# List all tables in proofpoint database
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "\dt"

# Describe a specific table
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "\d+ TABLE_NAME"

# Run a SQL query
docker exec proofpoint-db psql -U proofpoint -d proofpoint -c "SELECT * FROM users LIMIT 5;"

# Connect to database interactively
docker exec -it proofpoint-db psql -U proofpoint -d proofpoint
```

## Migration History

| Date | Migration File | Description | Applied By |
|------|---------------|-------------|------------|
| 2026-01-21 | 007_performance_tracker.sql | Added performance tracking tables (performance_entries, performance_artifacts) | Faisal |
| 2026-01-21 | 008_work_log_dashboard.sql | Added work log tables (work_tasks, work_subtasks, work_task_kpis) and extended performance_artifacts | Faisal |
| 2026-02-17 | 010_remove_tracker.sql | Removed all Tracker features - dropped work_tasks, work_subtasks, work_task_kpis, performance_artifacts, and performance_entries tables | Faisal |

---

**Last Updated:** 2026-02-17
