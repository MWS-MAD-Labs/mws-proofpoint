# Observations Feature — Bug Fixes & Review Notes

## Ringkasan File yang Diubah

```
src/
├── app/
│   ├── api/
│   │   └── observations/
│   │       ├── route.ts                     ← FIXED
│   │       ├── answer/route.ts              ← FIXED
│   │       └── [id]/
│   │           ├── route.ts                 ← FIXED
│   │           ├── submit/route.ts          ← FIXED (major)
│   │           └── acknowledge/route.ts     ← FIXED
│   └── observations/
│       └── page.tsx                         ← FIXED (major)
├── lib/
│   ├── auth-helpers.ts                      ← FIXED (multi-role support)
│   └── notifications/
│       └── observation-notifications.ts     ← FIXED (wrong import path)
prisma/
└── migrations/add_observations/migration.sql ← NEW
```

---

## Bug yang Diperbaiki

### 1. `requireRole()` tidak support multi-role (KRITIS)
**File:** `src/lib/auth-helpers.ts`

**Masalah:** `requireRole("staff", "admin")` dipanggil di kode tapi `requireRole` hanya menerima satu argumen.

**Fix:** Ubah signature menjadi `requireRole(...roles: string[])` dengan rest parameter. Admin selalu lolos semua pengecekan.

---

### 2. Submit route meminta `body.answers` yang tidak dikirim frontend (KRITIS)
**File:** `src/app/api/observations/[id]/submit/route.ts`

**Masalah:** 
- Frontend `handleSubmit` hanya memanggil `PATCH /api/observations/[id]/submit` tanpa body
- Backend mereturn 400 error karena `answers` tidak ada di body
- Padahal answers sudah tersimpan secara incremental via `saveAnswer` (onBlur)

**Fix:** Submit route tidak lagi memerlukan `body.answers`. Backend cukup validasi bahwa minimal ada satu answer dengan `score > 0` di database, lalu update status ke `submitted`.

---

### 3. Import path salah di observation-notifications (KRITIS)
**File:** `src/lib/notifications/observation-notifications.ts`

**Masalah:** 
```typescript
import { sendEmail } from '@/lib/email/client'; // ❌ file tidak ada
```

**Fix:**
```typescript
import { sendEmail } from '@/lib/email'; // ✅ sesuai dengan src/lib/email.ts
```

---

### 4. POST /api/observations hanya izinkan "manager", admin tidak bisa create
**File:** `src/app/api/observations/route.ts`

**Masalah:** `requireRole("manager")` → admin tidak bisa membuat observation.

**Fix:** `requireRole("manager", "admin")` + logic `managerId` tetap dari session.

---

### 5. answer/route.ts hanya izinkan "manager"
**File:** `src/app/api/observations/answer/route.ts`

**Masalah:** Admin tidak bisa mengisi jawaban observasi.

**Fix:** `requireRole("manager", "admin")` + admin bypass ownership check.

---

### 6. Frontend tidak pre-create answer rows, upsert bisa gagal
**File:** `src/app/api/observations/route.ts` (POST)

**Masalah:** Jika `observationAnswer` row belum ada saat `onBlur`, backend mencoba `update` tapi row tidak exist → error.

**Fix:** Saat membuat observation, langsung pre-create semua `observationAnswer` rows (score=0) untuk setiap indicator rubric. Answer route menggunakan `upsert` bukan conditional update/create.

---

### 7. Frontend types tidak include semua status dari Prisma schema
**File:** `src/app/observations/page.tsx`

**Masalah:** Type `Observation.status` hanya ada `'draft' | 'submitted' | 'acknowledged'`, padahal schema punya `pending` dan `reviewed` juga.

**Fix:** Update type menjadi `'draft' | 'pending' | 'submitted' | 'reviewed' | 'acknowledged'` + tambah `STATUS_CONFIG` untuk `pending` dan `reviewed`.

---

### 8. `canEdit` tidak mempertimbangkan admin
**File:** `src/app/observations/page.tsx`

**Masalah:** Admin tidak bisa edit observation yang bukan miliknya karena check `selected?.managerId === user?.id`.

**Fix:**
```typescript
const canEdit = isManager && selected?.status === 'draft' &&
  (selected?.managerId === user?.id || isAdmin);
```

---

### 9. `canSubmit` memungkinkan submit saat completedCount === 0
**File:** `src/app/observations/page.tsx` (original)

**Masalah:** Submit button disabled saat `completedCount === 0`, tapi cek di `canSubmit` tidak include kondisi ini.

**Fix:** `const canSubmit = canEdit && completedCount > 0;`

---

### 10. getStaffDisplayName tidak ada — hardcode `obs.staff?.email`
**File:** `src/app/observations/page.tsx`

**Masalah:** Jika `fullName` tersedia di profile, tidak ditampilkan.

**Fix:** Helper function `getStaffDisplayName(u)` → prefer `fullName` over `email`.

---

### 11. POST route tidak pre-validate rubric & staff sebelum create
**File:** `src/app/api/observations/route.ts`

**Masalah:** Jika `staffId` atau `rubricId` tidak valid, Prisma lempar FK constraint error yang kurang informatif.

**Fix:** Explicitly fetch staff dan rubric dulu, return 404 dengan pesan jelas jika tidak ditemukan.

---

## Cara Menjalankan Migration

```bash
# Development (auto-generate migration file)
npx prisma migrate dev --name add_observations

# Production
npx prisma migrate deploy

# Atau jalankan SQL manual:
psql $DATABASE_URL -f prisma/migrations/add_observations/migration.sql
```

## Environment Variables yang Dibutuhkan

```env
# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ari.wibowo@millennia21.id
SMTP_PASS=your_app_password
SMTP_FROM=noreply@smarttrack.com

# Email mode
SEND_EMAILS=false       # Set true untuk aktifkan email
TEST_MODE=true          # Set true untuk redirect semua email ke TEST_EMAIL
TEST_EMAIL=ari.wibowo@millennia21.id

# App
NEXTAUTH_URL=http://localhost:3000
```
