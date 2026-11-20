# Rencana: Semua Akses ProofPoint Diatur dari Central

- **Status:** Rencana, belum dikerjakan
- **Tanggal:** 2026-11-19
- **Repo terkait:** `mws-proofpoint`, `mws-central-database-user`
- **Lanjutan dari:** branch `feature/central-directory-sync` (sync akun, email, nama, NIY, dan jabatan dari Central)

## Progres (2026-11-20)

- [x] **Fase 1, Central** (branch `feat/field-unit`): `scope_unit_ids` di entitlement, pilihan "Units Managed" di Add Exception dan Change Role or Units, dikirim di API dan ikut kunci versi, standar akses v1.2, unit yang masih dipegang tidak bisa dihapus.
- [x] **Fase 2 dan 3, ProofPoint** (branch `feature/central-directory-sync`): `departments.central_unit_id`, `src/lib/central-structure-sync.ts`. Dengan login Hub, departemen dan membership selalu dari Central. Tab Users dan Departments tetap tampil tapi hanya-baca (tanpa tombol tambah, edit, hapus, assign), dan API tulisnya 409. Tidak ada flag.
- [ ] **Fase 4, rollout**: lihat di bawah.

## Langkah rollout

Karena tidak ada mode preview, perubahan langsung berlaku begitu ProofPoint baru jalan. Urutannya penting.

1. Deploy Central (`feat/field-unit` ke `staging`, lalu `main`).
2. **Sebelum** deploy ProofPoint, isi **Units Managed** di exception ProofPoint di Central:
   - mahrukh: Directorate, Elementary, Junior High, Kindergarten
   - putri.fitriyani: Elementary, Junior High, Kindergarten
   - romasta: Elementary, Junior High, Kindergarten
   - faisal: Directorate, MAD Lab
3. Pastikan token ProofPoint punya scope `employees:read`. Tanpa itu, departemen tidak disentuh sama sekali.
4. Backup DB ProofPoint, lalu jalankan:

   ```sql
   BEGIN;
   -- Nama sama dengan unit Central, supaya sync menautkannya.
   UPDATE departments SET name = 'MAD Lab', updated_at = NOW() WHERE name = 'Mad Labs';
   -- IT Support dilebur: anggotanya sudah staff di Mad Labs. Departemennya tetap ada,
   -- sync melepas membership-nya.
   UPDATE departments SET parent_id = NULL, updated_at = NOW() WHERE name = 'IT Support';
   COMMIT;
   ```

5. Deploy ProofPoint. Di Admin, kotak **Central sync** menampilkan hasil run pertama. Klik **Show department changes** untuk melihat semua yang berubah.
6. Bila satu run akan menghapus lebih dari separuh membership, run itu ditahan (`held`) dan tidak diterapkan. Cek Central, perbaiki, lalu **Sync now**.
7. Rollback: pulihkan backup tabel `departments`, `department_roles`, `department_role_memberships`, `profiles`, `user_roles`, lalu deploy versi sebelumnya.

## Aturan membership yang dipakai

- Semua orang dengan akses ProofPoint menjadi **staff** di unit Central-nya sendiri, termasuk admin, director, dan coach. Ini hanya membuat mereka bisa diobservasi di unit itu, tidak memberi hak apa pun.
- MANAGER dan SUPERVISOR memegang role-nya di `scope_unit_ids`, atau di unit sendiri bila kosong.
- Akun yang tertaut ke Central tapi tidak lagi punya akses: membership departemennya dilepas.
- Akun yang belum tertaut ke Central tidak disentuh, hanya diperingatkan.
- Membership global (`admin` tanpa departemen) tidak disentuh.

## Tujuan

Central menjadi satu-satunya tempat mengatur:

- **User:** siapa yang boleh masuk, nama, email, NIY, jabatan
- **Role:** Admin, Director, Instructional Coach, Manager, Supervisor, Staff
- **Departemen:** diambil dari unit Central, dan staf otomatis masuk sesuai unitnya
- **Kepala unit:** unit mana yang dipegang Manager/Supervisor

ProofPoint hanya menyimpan:

- **Hasil kerja:** observasi, appraisal, review, acknowledgement, dan riwayatnya
- **Pengaturan khusus aplikasi:** workflow approval, form/rubrik, notifikasi

Perubahan user, role, atau departemen cukup dilakukan di Central. ProofPoint menyesuaikan otomatis lewat sync.

## Ide utama

Sekitar 20 bagian ProofPoint membaca tabel `departments` dan `department_role_memberships`. Contohnya observasi, assessment, strategic plan, `organization-access.ts`, `effective-user-access.ts`, dan `hub-auth.ts`.

Tabel-tabel itu **tidak dihapus**. Yang berubah adalah **siapa yang mengisinya**: tadinya admin ProofPoint lewat tab Departments, sekarang sync otomatis dari Central. Dengan begitu, logika observasi dan appraisal tidak perlu diubah dan risikonya kecil.

## Kondisi Central saat ini

| Sudah ada | Belum ada |
|---|---|
| Role per orang lewat `ApplicationEntitlement` (`role` dan `permissions`) | Catatan unit yang dipegang seorang Manager/Supervisor |
| Setiap `Employee` wajib punya satu `unit_id` (`MasterUnit`) | Field cakupan unit pada entitlement |
| Akses per kelompok lewat `ApplicationAccessRule` (filter unit, posisi, dan level) | |
| API `/employees` mengirim nama unit | |

---

## Fase 1: Central (`mws-central-database-user`)

Tambahan kecil ini bisa dipakai semua aplikasi, tidak hanya ProofPoint.

1. **Database:** tambah `unit_ids String[] @default([])` di model `ApplicationEntitlement`. Artinya "unit yang dipegang", dan kalau kosong berarti unit orang itu sendiri.
2. **Penanda role:** tambah flag di `ApplicationRole`, misalnya `requires_unit_scope`. Pilihan unit hanya muncul untuk role yang membutuhkannya, misalnya MANAGER dan SUPERVISOR, tidak untuk Director atau Staff.
3. **UI Application Access, exception per orang** (`ExceptionAddPage.jsx`, `ExceptionsPanel.jsx`): saat memilih role yang butuh cakupan, muncul pilihan unit yang bisa dipilih lebih dari satu.
4. **API internal:**
   - `/application-entitlements` dan `/application-entitlements/lookup` mengirim `unit_ids`.
   - `/employees` dan `/employees/lookup` mengirim `unit_id` selain nama unit, supaya pencocokan tidak bergantung pada nama.
   - Perubahan `unit_ids` harus mengubah kunci di `/application-entitlements/version`, supaya aplikasi langsung tahu ada perubahan.
5. **Validasi:** setiap `unit_ids` harus merupakan unit yang ada.
6. **Test** untuk service dan API.

## Fase 2: ProofPoint, sync struktur dari Central

1. **Departemen = unit Central**
   - Tambah kolom `central_unit_id` (nullable, unique) di `departments`.
   - Departemen lama dicocokkan ke unit Central berdasarkan nama (tanpa memperhatikan huruf besar/kecil dan spasi).
   - Unit baru di Central otomatis dibuatkan departemennya.
   - Departemen yang tidak cocok dengan unit mana pun **tidak dihapus**. Departemen itu ditandai di daftar "need attention" admin.
   - Nama departemen ikut diganti kalau nama unit di Central berubah.
2. **Membership otomatis.** Setiap sync, membership dihitung ulang dari Central:

   | Role Central | Masuk departemen |
   |---|---|
   | STAFF | Unit karyawan itu |
   | MANAGER / SUPERVISOR | `unit_ids` yang dipilih di Central, atau unit karyawan itu sendiri kalau kosong |
   | ADMIN / DIRECTOR / INSTRUCTIONAL_COACH | Tidak perlu, karena sudah global |

   - Membership yang tidak ada lagi di Central dihapus. Membership baru dibuat. `department_roles` dibuat otomatis kalau belum ada untuk kombinasi departemen dan role tersebut.
   - `profiles.department_id` ikut diisi dari unit karyawan.
3. **Konkurensi:** pakai kunci per orang yang sama dengan proses login (`pg_advisory_xact_lock(hashtext(personId))`) dan kunci job yang sudah ada.
4. **Pengaman:**
   - Kalau entitlement atau daftar karyawan gagal dibaca atau kosong, membership **tidak** dihapus massal. Aturan ini sama seperti Daily Check-in.
   - Orang yang tidak ditemukan di daftar karyawan aktif dilewati dan masuk peringatan.
5. **Login:** `rolesWithinLocalDepartmentScope` tetap dipakai. Isi membership-nya sekarang datang dari Central, jadi role MANAGER langsung berlaku tanpa perlu di-assign manual seperti kasus Kholida.

## Fase 3: ProofPoint, admin hanya-baca (mode Hub)

| Menu | Mode Hub |
|---|---|
| **Users** | Hanya-baca. Tambah, hapus, suspend, ganti password, dan edit role disembunyikan. Ada tautan "Kelola di Central" |
| **Departments** | Hanya-baca. Menampilkan siapa ada di unit mana, sumbernya Central. Tambah/hapus departemen dan assign member dimatikan |
| **Workflows** | Tetap bisa diedit (workflow per role departemen) |
| **Reviews / rubrik** | Tetap bisa diedit |
| **Notifications** | Tetap bisa diedit |

- API admin yang mengubah data menolak dengan 409 dan pesan "Managed in Central" kalau mode Hub aktif:
  - `/api/admin/users` (POST/PUT/DELETE)
  - `/api/admin/department-roles` (POST/PUT/DELETE)
  - `/api/admin/department-role-memberships` (PUT)
  - Perubahan departemen di `/api/departments`
- Mode non-Hub (login lokal) tetap seperti sekarang.

## Fase 4: Migrasi data lama dan rollout

1. **Dry run** di staging, lewat mode laporan tanpa mengubah data:
   - Departemen yang cocok atau tidak dengan unit Central
   - Membership yang akan ditambah atau dihapus per orang
   - Orang dengan role Manager/Supervisor yang cakupannya berubah
2. **Lengkapi data di Central:** admin mengisi `unit_ids` untuk kepala unit yang memegang lebih dari satu unit, **sebelum** sync membership diaktifkan.
3. **Feature flag:** `PROOFPOINT_CENTRAL_MANAGES_DEPARTMENTS=true`. Kalau `false`, perilaku sekarang tetap dipakai, sehingga bisa dimatikan kalau ada masalah.
4. **Urutan deploy:**
   1. Central (migration dan API) ke staging, lalu ke prod
   2. ProofPoint ke staging dengan flag mati, lalu jalankan dry run
   3. Cek hasil dry run bersama
   4. Nyalakan flag di staging dan uji (lihat checklist di bawah)
   5. Ulangi di prod
5. **Backup** tabel `departments`, `department_roles`, dan `department_role_memberships` sebelum flag dinyalakan di prod.

## Checklist uji

- [ ] Karyawan baru dengan akses di Central muncul di ProofPoint dengan departemen sesuai unitnya
- [ ] Karyawan yang pindah unit di Central ikut pindah departemen di ProofPoint
- [ ] Manager dengan `unit_ids` kosong hanya bisa mengobservasi staf unitnya sendiri
- [ ] Manager dengan beberapa `unit_ids` bisa mengobservasi staf di semua unit itu
- [ ] Director dan Instructional Coach tetap bisa mengobservasi semua staf
- [ ] Role yang dicabut di Central membuat membership terkait hilang dan akses tertolak
- [ ] Central tidak bisa diakses: membership tidak berubah dan error tampil di status sync
- [ ] Menu Users dan Departments hanya-baca, dan API perubahan menolak dengan 409
- [ ] Workflow, rubrik, dan notifikasi tetap bisa diedit
- [ ] Observasi dan appraisal lama tetap tampil dan terhubung ke departemen yang benar

## Yang perlu dipastikan sebelum mulai

1. ~~Nama departemen di ProofPoint prod~~ **Sudah dicek:** 10 dari 13 cocok. Mad Labs dan MAD Lab perlu dipetakan. Lihat "Hasil cek DB prod".
2. ~~Sub-departemen~~ **Sudah dicek:** hanya IT Support (di bawah Mad Labs), dengan 1 anggota.
3. ~~Staf di lebih dari satu departemen~~ **Sudah dicek:** hanya ananta (IT Support dan Mad Labs).
4. **Izin mengubah repo Central:** apakah boleh dikerjakan langsung atau harus lewat tim lain.

Query read-only untuk mengecek poin 1–3 di DB prod:

```sql
-- Daftar departemen beserta jumlah member per role
SELECT d.name, parent.name AS parent, dr.role, count(m.id) AS members
  FROM departments d
  LEFT JOIN departments parent ON parent.id = d.parent_id
  LEFT JOIN department_roles dr ON dr.department_id = d.id
  LEFT JOIN department_role_memberships m ON m.department_role_id = dr.id
 GROUP BY d.name, parent.name, dr.role
 ORDER BY d.name, dr.role;

-- Staf yang masuk lebih dari satu departemen
SELECT u.email, array_agg(DISTINCT d.name) AS departments
  FROM department_role_memberships m
  JOIN department_roles dr ON dr.id = m.department_role_id
  JOIN departments d ON d.id = dr.department_id
  JOIN users u ON u.id = m.user_id
 WHERE dr.role::text = 'staff'
 GROUP BY u.email
HAVING count(DISTINCT d.id) > 1;

-- Manager/Supervisor yang memegang lebih dari satu departemen
SELECT u.email, dr.role, array_agg(DISTINCT d.name) AS departments
  FROM department_role_memberships m
  JOIN department_roles dr ON dr.id = m.department_role_id
  JOIN departments d ON d.id = dr.department_id
  JOIN users u ON u.id = m.user_id
 WHERE dr.role::text IN ('manager', 'supervisor')
 GROUP BY u.email, dr.role
HAVING count(DISTINCT d.id) > 1;
```

## Hasil cek DB prod (2026-11-19)

Daftar unit Central di bawah ini diambil dari DB Central **lokal**. Cocokkan lagi dengan Central prod sebelum migrasi.

### Departemen ProofPoint dibandingkan dengan unit Central

| Departemen ProofPoint | Staff | Manager | Unit Central | Tindakan |
|---|---|---|---|---|
| BRIDGE | 3 | 1 | BRIDGE | Cocok |
| CARE | 2 | 1 | CARE | Cocok |
| COMPASS | 2 | 1 | COMPASS | Cocok |
| Directorate | 6 | 2 | Directorate | Cocok |
| Elementary | 43 | 4 | Elementary | Cocok |
| Junior High | 13 | 3 | Junior High | Cocok |
| Kindergarten | 12 | 4 | Kindergarten | Cocok |
| RISE | 2 | 1 | RISE | Cocok |
| SAFE | 1 | 0 | SAFE | Cocok |
| SHIELD | 22 | 1 | SHIELD | Cocok |
| **Mad Labs** | 2 | 1 | **MAD Lab** | Nama beda. Petakan manual (alias) atau samakan namanya di salah satu sisi |
| **IT Support** (sub dari Mad Labs) | 1 | 0 | Tidak ada | Satu-satunya sub-departemen. Anggotanya (ananta) juga staff di Mad Labs. Usul: lebur ke Mad Labs |
| **Management** | 0 | 0 | Tidak ada | Kosong. Biarkan saja (tidak dihapus, tidak dipakai) |
| Tidak ada | | | **Pelangi** | Dibuat otomatis saat sync |
| Tidak ada | | | **Unknown / Legacy** | Jangan dibuat. Unit placeholder Central, dilewati dan ditandai |

### Temuan

1. **10 dari 13 departemen** namanya sama persis dengan unit Central, jadi pencocokan nama hampir semuanya aman.
2. **Supervisor tidak dipakai.** Semua departemen punya 0 supervisor. Cakupan unit cukup diuji untuk Manager.
3. **Staf di dua departemen:** hanya `ananta@millennia21.id` (IT Support dan Mad Labs). Setelah IT Support dilebur, masalah ini hilang.
4. **Kepala yang memegang lebih dari satu unit.** Ini yang membuat Fase 1 (`unit_ids` di Central) **wajib**, karena opsi "unit sendiri saja" akan membuat mereka kehilangan akses:

   | Manager | Unit yang dipegang sekarang |
   |---|---|
   | mahrukh@millennia21.id | Directorate, Elementary, Junior High, Kindergarten |
   | putri.fitriyani@millennia21.id | Elementary, Junior High, Kindergarten |
   | romasta@millennia21.id | Elementary, Junior High, Kindergarten |
   | faisal@millennia21.id | Directorate, Mad Labs |

   Keempat orang ini harus diisi `unit_ids`-nya di Central sebelum flag dinyalakan (Fase 4 langkah 2).

### Keputusan yang masih dibutuhkan

- [ ] Mad Labs dan MAD Lab: ganti nama di ProofPoint menjadi `MAD Lab`, atau pakai pemetaan manual
- [ ] IT Support: lebur ke Mad Labs (usulan)
- [ ] Management: dibiarkan kosong (usulan)
- [ ] Konfirmasi daftar unit di Central **prod** sama dengan daftar lokal di atas

## Perkiraan pekerjaan

| Fase | Ukuran |
|---|---|
| 1. Central | Sedang (migration, API, UI pilih unit, test) |
| 2. Sync struktur ProofPoint | Sedang (lanjutan sync yang sudah ada) |
| 3. Admin hanya-baca | Kecil |
| 4. Dry run dan migrasi | Kecil, tapi perlu dicek bersama |

## Risiko

| Risiko | Penanganan |
|---|---|
| Nama departemen tidak cocok dengan unit Central | Dry run dan daftar "need attention"; departemen tidak pernah dihapus otomatis |
| Membership terhapus massal karena Central error | Data yang gagal dibaca atau kosong tidak pernah dipakai untuk menghapus |
| Kepala unit kehilangan akses ke unit kedua | Isi `unit_ids` di Central sebelum flag dinyalakan |
| Workflow terikat ke `department_roles` lama | `department_roles` tidak dihapus, hanya dicocokkan dan dipakai ulang |
| Perlu rollback | Matikan `PROOFPOINT_CENTRAL_MANAGES_DEPARTMENTS`, lalu pulihkan dari backup tabel |
