# Proofpoint Dashboard: Supabase to Self-Hosted Docker Migration Plan

**Version:** 1.0
**Date:** 2025-12-30
**Target Timeline:** Production-ready deployment (11 weeks)

---

## Executive Summary

This document provides a comprehensive refactoring plan to migrate the Proofpoint Dashboard from Supabase to a fully self-hosted Docker solution. The architecture has transitioned from a separate Vite/Fastify setup to a unified Next.js application. The migration will replace Supabase Auth, Database, and Storage with Auth.js, self-hosted PostgreSQL, and local filesystem storage respectively, while maintaining all existing functionality within the Next.js framework.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Target Architecture](#2-target-architecture)
3. [Database Schema & Migration Strategy](#3-database-schema--migration-strategy)
4. [Backend API Design (Fastify)](#4-backend-api-design-fastify)
5. [Authentication Migration (Auth.js)](#5-authentication-migration-authjs)
6. [File Storage Implementation](#6-file-storage-implementation)
7. [Docker Compose Configuration](#7-docker-compose-configuration)
8. [Nginx Reverse Proxy Setup](#8-nginx-reverse-proxy-setup)
9. [Frontend Refactoring](#9-frontend-refactoring)
10. [Environment Variables & Secrets](#10-environment-variables--secrets)
11. [CI/CD Pipeline (GitHub Actions)](#11-cicd-pipeline-github-actions)
12. [Implementation Phases](#12-implementation-phases)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment Instructions (Komodo)](#14-deployment-instructions-komodo)
15. [Rollback & Disaster Recovery](#15-rollback--disaster-recovery)

---

## 1. Current Architecture Analysis

### 1.1 Supabase Dependencies Identified

**Authentication:**
- Files: `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`
- Uses: `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`, `supabase.auth.onAuthStateChange()`, `supabase.auth.getSession()`
- Features: Email/password authentication, session management, automatic profile creation on signup

**Database Queries:**
- 56 total occurrences of `.select()`, `.insert()`, `.update()`, `.delete()` across 12 files
- Key files:
  - Admin panel: `src/pages/Admin.tsx` (370 lines)
  - Dashboard: `src/pages/Dashboard.tsx` (325 lines)
  - Self-assessment: `src/pages/SelfAssessment.tsx` (722 lines)
  - Manager review: `src/pages/ManagerReview.tsx` (755 lines)
  - Director approval: `src/pages/DirectorApproval.tsx` (807 lines)
  - Rubrics management: `src/pages/Rubrics.tsx` (547 lines)

**Storage:**
- File: `src/components/assessment/EvidenceInput.tsx`
- Bucket: `evidence`
- Uses: `supabase.storage.from('evidence').upload()`, `supabase.storage.from('evidence').getPublicUrl()`
- File types: PDF, Word, Excel, images (.pdf, .doc, .docx, .xls, .xlsx, .png, .jpg, .jpeg, .gif, .txt)
- Storage pattern: `{user_id}/{timestamp}_{filename}`

### 1.2 Database Schema Overview

**Tables (8 total):**
1. `departments` - Hierarchical organization structure (self-referencing)
2. `profiles` - User profile information (linked to auth.users)
3. `user_roles` - Role assignments (admin, staff, manager, director)
4. `rubric_templates` - Assessment templates
5. `rubric_sections` - Template sections with weights
6. `rubric_indicators` - Specific evaluation criteria
7. `assessments` - Performance assessments with workflow states
8. `assessment_questions` - Q&A between staff and managers

**Key Features:**
- Row Level Security (RLS) policies on all tables
- Custom PostgreSQL functions: `has_role()`, `get_user_department()`
- Triggers: Auto-update timestamps, profile creation on user signup
- ENUM types: `app_role` (admin, staff, manager, director)
- Status workflow: draft → submitted → manager_reviewed → approved → acknowledged

---

## 2. Target Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                           │
│                    (React + Vite Frontend)                       │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nginx Reverse Proxy                         │
│              (SSL Termination, Static Files, /api routing)       │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           │ Static files                     │ /api/* routes
           │                                  │
           ▼                                  ▼
┌─────────────────────┐           ┌──────────────────────────────┐
│   Frontend (Next.js)│           │   API Routes (Next.js)        │
│   - React Components│           │   - Serverless endpoints      │
│   - App Router      │           │   - Auth.js integration       │
│                     │           │   - File upload handling      │
└─────────────────────┘           └───────┬──────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
        ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
        │   PostgreSQL DB    │  │   Auth.js        │  │  Local FS    │
        │   (Self-hosted)    │  │   Sessions       │  │  (Evidence)  │
        └────────────────────┘  └──────────────────┘  └──────────────┘
```

### 2.2 Service Components

**Docker Services:**
1. **nginx** - Reverse proxy and static file server
2. **backend** - Node.js/Fastify API server
3. **postgres** - PostgreSQL 16 database

**Data Volumes:**
- `postgres-data` - Database persistence
- `evidence-files` - Uploaded evidence documents

---

## 3. Database Schema & Migration Strategy

### 3.1 Schema Recreation

Since starting fresh, we'll recreate the schema from scratch using the existing Supabase migrations.

**Create `backend/database/schema.sql`:**

```sql
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'manager', 'director');

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create users table (replaces auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id, role)
);

-- Create rubric templates table
CREATE TABLE public.rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rubric sections table
CREATE TABLE public.rubric_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  weight DECIMAL(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rubric indicators table
CREATE TABLE public.rubric_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.rubric_sections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  evidence_guidance TEXT,
  score_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  director_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.rubric_templates(id) ON DELETE SET NULL,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'submitted', 'manager_reviewed', 'acknowledged', 'approved', 'rejected')
  ),
  staff_scores JSONB DEFAULT '{}',
  manager_scores JSONB DEFAULT '{}',
  staff_evidence JSONB DEFAULT '{}',
  manager_evidence JSONB DEFAULT '{}',
  manager_notes TEXT,
  director_comments TEXT,
  final_score DECIMAL(4,2),
  final_grade TEXT,
  staff_submitted_at TIMESTAMPTZ,
  manager_reviewed_at TIMESTAMPTZ,
  director_approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create assessment questions table
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  indicator_id UUID REFERENCES public.rubric_indicators(id) ON DELETE SET NULL,
  asked_by UUID NOT NULL REFERENCES public.users(id),
  question TEXT NOT NULL,
  response TEXT,
  responded_by UUID REFERENCES public.users(id),
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create files table for evidence storage
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_assessments_staff_id ON public.assessments(staff_id);
CREATE INDEX idx_assessments_manager_id ON public.assessments(manager_id);
CREATE INDEX idx_assessments_director_id ON public.assessments(director_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions(assessment_id);
CREATE INDEX idx_files_user_id ON public.files(user_id);

-- Utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rubric_templates_updated_at
  BEFORE UPDATE ON public.rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
  BEFORE UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessment_questions_updated_at
  BEFORE UPDATE ON public.assessment_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Note:** RLS policies will be replaced by API-level authorization in Fastify middleware.

---

## 4. Backend API Design (Fastify)

### 4.1 Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Fastify app setup
│   ├── config/
│   │   ├── database.ts          # PostgreSQL connection pool
│   │   ├── auth.ts              # Auth.js configuration
│   │   └── storage.ts           # File storage config
│   ├── plugins/
│   │   ├── auth.ts              # Auth.js Fastify plugin
│   │   ├── cors.ts              # CORS configuration
│   │   └── multipart.ts         # File upload handling
│   ├── middleware/
│   │   ├── authenticate.ts      # Verify session
│   │   ├── authorize.ts         # Role-based access
│   │   └── errorHandler.ts     # Global error handling
│   ├── routes/
│   │   ├── auth.routes.ts       # /api/auth/*
│   │   ├── users.routes.ts      # /api/users/*
│   │   ├── profiles.routes.ts   # /api/profiles/*
│   │   ├── departments.routes.ts # /api/departments/*
│   │   ├── rubrics.routes.ts    # /api/rubrics/*
│   │   ├── assessments.routes.ts # /api/assessments/*
│   │   ├── questions.routes.ts  # /api/questions/*
│   │   └── files.routes.ts      # /api/files/*
│   ├── services/
│   │   ├── auth.service.ts      # Authentication logic
│   │   ├── user.service.ts      # User management
│   │   ├── assessment.service.ts # Assessment business logic
│   │   ├── rubric.service.ts    # Rubric management
│   │   └── file.service.ts      # File operations
│   ├── repositories/
│   │   ├── user.repository.ts   # User DB operations
│   │   ├── profile.repository.ts # Profile DB operations
│   │   ├── assessment.repository.ts # Assessment DB operations
│   │   └── rubric.repository.ts # Rubric DB operations
│   └── utils/
│       ├── password.ts          # bcrypt utilities
│       ├── validation.ts        # Zod schemas
│       └── logger.ts            # Winston logger
├── database/
│   ├── schema.sql               # Database schema
│   ├── seed.sql                 # Initial data
│   └── migrations/              # Future schema changes
├── uploads/                     # Mounted volume for files
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 4.2 Key API Endpoints

**Authentication (`/api/auth`)**
```
POST   /api/auth/register        # Sign up new user
POST   /api/auth/login           # Sign in
POST   /api/auth/logout          # Sign out
GET    /api/auth/session         # Get current session
```

**Users & Profiles (`/api/users`, `/api/profiles`)**
```
GET    /api/profiles/me          # Current user profile
PUT    /api/profiles/me          # Update own profile
GET    /api/profiles             # List all profiles (admin)
GET    /api/profiles/:id         # Get specific profile
PUT    /api/profiles/:id         # Update profile (admin)
GET    /api/users/:id/roles      # Get user roles
PUT    /api/users/:id/roles      # Update user roles (admin)
```

**Departments (`/api/departments`)**
```
GET    /api/departments          # List all departments
POST   /api/departments          # Create department (admin)
PUT    /api/departments/:id      # Update department (admin)
DELETE /api/departments/:id      # Delete department (admin)
```

**Rubrics (`/api/rubrics`)**
```
GET    /api/rubrics              # List templates
POST   /api/rubrics              # Create template (manager+)
GET    /api/rubrics/:id          # Get template with sections
PUT    /api/rubrics/:id          # Update template
DELETE /api/rubrics/:id          # Delete template (admin)
```

**Assessments (`/api/assessments`)**
```
GET    /api/assessments          # List assessments (filtered by role)
POST   /api/assessments          # Create assessment
GET    /api/assessments/:id      # Get assessment details
PUT    /api/assessments/:id      # Update assessment
PUT    /api/assessments/:id/submit    # Submit for review
PUT    /api/assessments/:id/review    # Manager review
PUT    /api/assessments/:id/approve   # Director approval
```

**Files (`/api/files`)**
```
POST   /api/files/upload         # Upload evidence file
GET    /api/files/:id            # Download file
DELETE /api/files/:id            # Delete file
```

---

## 5. Authentication Migration (Auth.js)

Auth.js will replace Supabase Auth with JWT-based sessions stored in HTTP-only cookies.

**Key Features:**
- Credential-based authentication (email/password)
- JWT sessions (stateless, no DB queries per request)
- Bcrypt password hashing
- CSRF protection
- Session management with configurable expiry

**Session Flow:**
1. User submits credentials to `/api/auth/login`
2. Backend validates credentials against database
3. Auth.js generates signed JWT with user ID and roles
4. JWT stored in HTTP-only cookie
5. Future requests include cookie automatically
6. Middleware verifies JWT signature and extracts user info

---

## 6. File Storage Implementation

### 6.1 Local Filesystem Structure

```
backend/uploads/
├── evidence/
│   ├── {user_id}/
│   │   ├── {timestamp}_{filename}.pdf
│   │   ├── {timestamp}_{filename}.docx
│   │   └── ...
│   └── ...
```

### 6.2 Features

- Files stored in user-specific directories
- Unique filenames using timestamps and UUIDs
- File metadata stored in PostgreSQL
- Access control enforced at API level
- Supported types: PDF, Word, Excel, images, text
- Maximum file size: 50MB (configurable)

---

## 7. Docker Compose Configuration

**`docker-compose.yml`**

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: proofpoint-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-proofpoint}
      POSTGRES_USER: ${POSTGRES_USER:-proofpoint}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backend/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
      - ./backend/database/seed.sql:/docker-entrypoint-initdb.d/02-seed.sql:ro
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-proofpoint}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - proofpoint-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: proofpoint-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-proofpoint}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-proofpoint}
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: ${AUTH_URL:-http://localhost/api/auth}
      UPLOAD_DIR: /app/uploads/evidence
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-http://localhost}
    volumes:
      - evidence-files:/app/uploads/evidence
    ports:
      - "127.0.0.1:3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - proofpoint-network

  nginx:
    image: nginx:alpine
    container_name: proofpoint-nginx
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - proofpoint-network

volumes:
  postgres-data:
  evidence-files:

networks:
  proofpoint-network:
    driver: bridge
```

---

## 8. Nginx Reverse Proxy Setup

Nginx serves three purposes:
1. **Reverse proxy** for backend API (`/api/*` → `backend:3000`)
2. **Static file server** for frontend build (`/` → `/usr/share/nginx/html`)
3. **SSL termination** for HTTPS (production)

Key configuration:
- API requests proxied to backend
- Static assets cached for 1 year
- HTML files not cached
- Security headers added
- CORS handled by backend

---

## 9. Frontend Refactoring

### 9.1 Changes Required

1. **Create new API client** (`src/lib/apiClient.ts`) to replace Supabase client
2. **Update useAuth hook** to use new authentication endpoints
3. **Replace all Supabase imports** across the codebase
4. **Update file upload logic** in `EvidenceInput.tsx`
5. **Update environment variables** in `.env`

### 9.2 Migration Strategy

The API client will provide a Supabase-compatible interface to minimize code changes:

```typescript
// Old (Supabase)
const { data } = await supabase.from('profiles').select('*').eq('user_id', userId);

// New (API Client - similar interface)
const { data } = await apiClient.from('profiles').select('*').eq('user_id', userId);
```

This compatibility layer reduces refactoring work and potential bugs.

---

## 10. Environment Variables & Secrets

### Backend Variables
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_SECRET` - JWT signing secret (32+ chars)
- `AUTH_URL` - Auth.js callback URL
- `ALLOWED_ORIGINS` - CORS allowed origins
- `UPLOAD_DIR` - File storage directory
- `MAX_FILE_SIZE` - Upload size limit

### Frontend Variables
- `VITE_API_URL` - Backend API endpoint

### Secret Generation
```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 24
```

---

## 11. CI/CD Pipeline (GitHub Actions)

### Workflow Steps

1. **Test** - Run backend tests and frontend linting
2. **Build Backend** - Create Docker image and push to registry
3. **Build Frontend** - Build static files and upload as artifact
4. **Deploy** - Trigger Komodo deployment with new image tag

### GitHub Secrets Required
- `KOMODO_API_KEY`
- `KOMODO_ENDPOINT`
- `KOMODO_DEPLOYMENT_ID`
- `VITE_API_URL`

---

## 12. Implementation Phases

### Phase 1: Setup & Infrastructure (Week 1-2)
- Create backend project structure
- Set up Docker Compose locally
- Create database schema
- Configure basic Fastify server

### Phase 2: Authentication (Week 2-3)
- Implement Auth.js integration
- Create auth routes
- Implement password hashing
- Test authentication flow

### Phase 3: Core API Endpoints (Week 3-5)
- Implement repository pattern
- Build API routes for users, profiles, departments, rubrics
- Add authorization middleware
- Implement error handling

### Phase 4: Assessments API (Week 5-6)
- Implement assessment CRUD
- Build workflow endpoints
- Create questions endpoints
- Add status validation

### Phase 5: File Upload & Storage (Week 6-7)
- Implement file upload endpoint
- Create file service
- Add file metadata table
- Implement download with access control

### Phase 6: Frontend Migration (Week 7-9)
- Create API client
- Update useAuth hook
- Replace Supabase imports
- Update file upload component
- Test all pages

### Phase 7: Production Deployment (Week 9-10)
- Configure production environment
- Set up SSL certificates
- Deploy to Komodo
- Configure CI/CD
- Set up monitoring

### Phase 8: Polish & Documentation (Week 10-11)
- Performance optimization
- Security hardening
- Complete documentation
- Training

**Total Timeline: 11 weeks**

---

## 13. Testing Strategy

### Unit Tests
- Test services in isolation
- Mock database repositories
- Test password hashing/verification
- Test validation schemas

### Integration Tests
- Test API endpoints with test database
- Test authentication flows
- Test authorization rules
- Test file uploads

### E2E Tests
- Test complete user journeys
- Test different user roles
- Test assessment workflow
- Test file uploads

### Load Testing
- 100 concurrent users
- File upload stress test
- Database query performance

---

## 14. Deployment Instructions (Komodo)

### Prerequisites
1. Proxmox container with Docker installed
2. Komodo configured with container access
3. SSL certificates obtained
4. DNS configured

### Deployment Steps
1. Create stack in Komodo with services defined
2. Configure secrets in Komodo
3. Upload SSL certificates
4. Deploy stack
5. Initialize database
6. Verify deployment

### Monitoring
- Health checks via `/health` endpoint
- Log monitoring via Komodo dashboard
- Database connection pool monitoring
- File storage usage tracking

---

## 15. Rollback & Disaster Recovery

### Backup Strategy
- **Database**: Daily automated backups (pg_dump)
- **Files**: Daily evidence files backup (tar.gz)
- **Retention**: 30 days
- **Cron scheduled**: 2 AM daily

### Restore Procedures
1. Stop affected services
2. Restore from backup
3. Restart services
4. Verify functionality

### Disaster Recovery
- **RTO**: 4 hours
- **RPO**: 24 hours (daily backups)

---

## Implementation Checklist

### Pre-Migration
- [ ] Review current Supabase usage
- [ ] Set up development environment
- [ ] Document current API flows
- [ ] Identify all dependencies

### Development (8 Phases)
- [ ] Phase 1: Infrastructure
- [ ] Phase 2: Authentication
- [ ] Phase 3: Core API
- [ ] Phase 4: Assessments
- [ ] Phase 5: File Storage
- [ ] Phase 6: Frontend
- [ ] Phase 7: Deployment
- [ ] Phase 8: Documentation

### Testing
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Load testing
- [ ] Security audit

### Deployment
- [ ] Production environment configured
- [ ] SSL certificates installed
- [ ] Monitoring set up
- [ ] Backup automation
- [ ] CI/CD functional

---

## Critical Files to Create

1. **`backend/src/app.ts`** - Core Fastify application setup
2. **`backend/database/schema.sql`** - PostgreSQL schema
3. **`src/lib/apiClient.ts`** - API client replacing Supabase
4. **`backend/src/config/auth.ts`** - Auth.js configuration
5. **`docker-compose.yml`** - Multi-container orchestration

---

## Summary

This migration plan provides a complete roadmap for transitioning from Supabase to a fully self-hosted Docker solution with:

- **Node.js/Fastify** backend
- **Auth.js** authentication
- **PostgreSQL** database
- **Local filesystem** storage
- **Docker Compose** orchestration
- **Nginx** reverse proxy
- **Komodo** deployment management
- **GitHub Actions** CI/CD

**Timeline**: 11 weeks to production-ready deployment

**Benefits**:
- Full infrastructure control
- No vendor lock-in
- Reduced operational costs
- Enhanced data sovereignty
- Improved security and compliance
