# Prisma Setup Guide

This guide covers how to use Prisma for database migrations and queries in the ProofPoint Dashboard.

## What is Prisma?

Prisma is a next-generation ORM that provides:
- **Type-safe database access** with auto-generated TypeScript types
- **Better migrations** with automatic SQL generation
- **Database Studio** for viewing data visually
- **Better DX** with IntelliSense and compile-time error checking

## Installation

Prisma is already installed in this project:
```bash
npm install
```

## Available Scripts

```bash
# Generate Prisma Client (run after schema changes)
npm run db:generate

# Push schema changes directly to database (dev only)
npm run db:push

# Create and apply a new migration
npm run db:migrate:dev

# Apply migrations on production
npm run db:migrate:deploy

# Reset database and reapply all migrations
npm run db:migrate:reset

# Open Prisma Studio (visual database browser)
npm run db:studio
```

## Making Schema Changes

### 1. Modify `prisma/schema.prisma`

Edit the Prisma schema file to add/modify models:
```prisma
model NewModel {
  id        String   @id @default(uuid())
  name      String   @db.Text
  createdAt DateTime @default(now())
}
```

### 2. Generate the Prisma Client

```bash
npm run db:generate
```

This regenerates the TypeScript types based on your schema.

### 3. Apply Changes to Database

**For Development:**
```bash
npm run db:push
```
This pushes schema changes directly without creating a migration file.

**For Production:**
```bash
npm run db:migrate:dev --name describe_your_changes
```
This creates a new migration file in `prisma/migrations/` that can be version controlled.

## Using Prisma in Code

### Import the Client

```typescript
import { prisma } from '@/lib/prisma';
```

### Basic Queries

```typescript
// Find all users
const users = await prisma.user.findMany();

// Find user by email
const user = await prisma.user.findUnique({
  where: { email: 'user@example.com' }
});

// Create new user
const newUser = await prisma.user.create({
  data: {
    email: 'new@example.com',
    passwordHash: 'hash',
  }
});

// Update user
const updatedUser = await prisma.user.update({
  where: { id: userId },
  data: { email: 'newemail@example.com' }
});

// Delete user
await prisma.user.delete({
  where: { id: userId }
});
```

### Relations

```typescript
// Include related data
const userWithProfile = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    profile: true,
    roles: true,
  }
});

// Create with relations
const assessment = await prisma.assessment.create({
  data: {
    staffId: userId,
    templateId: templateId,
    period: '2024-2025 Semester 1',
    status: 'draft',
    questions: {
      create: {
        askedBy: managerId,
        question: 'What is your progress?',
        status: 'pending',
      }
    }
  }
});
```

### Transactions

```typescript
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { email: 'test@example.com', passwordHash: 'hash' }
  });
  
  const profile = await tx.profile.create({
    data: {
      userId: user.id,
      email: 'test@example.com',
      fullName: 'Test User'
    }
  });
  
  return { user, profile };
});
```

## Migration Best Practices

### Development Workflow

1. Make schema changes in `prisma/schema.prisma`
2. Run `npm run db:migrate:dev --name description`
3. Prisma generates SQL migration and applies it
4. Commit the migration file

### Production Workflow

1. Pull latest code with new migrations
2. Run `npm run db:migrate:deploy`
3. This applies all pending migrations safely

### Migration Files

Migration files are stored in `prisma/migrations/` with this structure:
```
prisma/migrations/
  20240101000000_init/
    migration.sql
```

## Prisma Studio

Prisma Studio is a visual database browser:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View and filter data
- Create, edit, and delete records
- Explore relationships

## Environment Variables

The database connection is configured in `.env`:

```env
DATABASE_URL=postgresql://proofpoint:password@localhost:5432/proofpoint
```

Prisma 7 uses `prisma.config.ts` for configuration:
```typescript
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

## Replacing the Old `pg` Pool

The old `lib/db.ts` using `pg` can be gradually replaced:

### Old way (using pg):
```typescript
import { query } from '@/lib/db';
const users = await query<User>('SELECT * FROM users');
```

### New way (using Prisma):
```typescript
import { prisma } from '@/lib/prisma';
const users = await prisma.user.findMany();
```

## Benefits of Prisma

1. **Type Safety**: Full TypeScript autocomplete
2. **Better Migrations**: Automatic SQL generation
3. **Relations**: Easy to work with related data
4. **Studio**: Visual database browser
5. **Performance**: Connection pooling, query optimization
6. **Productivity**: Less boilerplate code

## Troubleshooting

### Error: "P1012: url is no longer supported"
Make sure you're using Prisma 7 configuration. The `url` field should be in `prisma.config.ts`, not in `schema.prisma`.

### Error: "Unknown function uuid()"
Use `@default(uuid())` not `@default(gen_random_uuid())` in Prisma 7.

### Migration conflicts
If migrations get out of sync:
```bash
npm run db:migrate:reset
```
This resets the database and re-applies all migrations (dev only!).

## Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
