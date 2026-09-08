# supabase/ — Database FotoSnaps (sumber kebenaran skema)

Arsitektur final: **satu database per perusahaan**. Folder ini isinya
skema database **khusus FotoSnaps**. Bujangan Food nanti punya
`supabase/` sendiri di project/repo terpisah (lihat `database/README.md`).

## Struktur

```
supabase/
├── config.toml
├── migrations/
│   ├── 001_foundation.sql              # roles, users (link ke auth.users), user_roles, crew
│   ├── 002_workforce.sql               # stores+assignment+schedule, events+location+assignment+schedule
│   ├── 003_attendance.sql              # attendance_logs, corrections, permissions, overtimes
│   ├── 004_equipment.sql               # equipment_assets, checklist, inspection_reports (khusus FotoSnaps)
│   ├── 005_audit_rls.sql               # audit_logs, notifications, RLS berbasis auth.uid()
│   └── 006_attendance_calendar_fields.sql  # status diperluas + overtime_minutes/status untuk Kalender Kerja
│   └── 007_event_workflows.sql         # persistensi progress workflow event
└── seed.sql                            # HANYA role baku — akun admin dibuat lewat script, bukan SQL
```

## Beda penting dari desain sebelumnya

- **Tidak ada `tenants` / `user_tenants` / `tenant_id`** — database ini sudah khusus satu perusahaan.
- **Password dikelola Supabase Auth** (`auth.users`), bukan kolom `password_hash` custom. Tabel `public.users` cuma profil, id-nya SAMA dengan `auth.users.id`.
- **RLS pakai `auth.uid()`** langsung, bukan `current_setting('app.current_tenant_id')`.
- **`store_schedule_id` & `event_schedule_id` eksplisit** di `attendance_logs` (bukan satu kolom `schedule_id` generik) — foreign key jadi valid.

## Cara menjalankan

```bash
supabase db reset
```

Ini akan: drop semua tabel → jalankan migration 001-006 berurutan → jalankan `seed.sql` (isi role). Setelah itu, buat akun admin pertama:

```bash
cd backend
node scripts/bootstrap-admin.js
```

Script itu akan tanya email/nama/password, lalu membuat akun lewat Supabase Auth Admin API + mengaitkan role `SUPER_ADMIN`. Detail lengkap ada di `docs/ADMIN_CREW_ACCOUNTS.md`.

## Tabel final (sesuai REPORT_PROGRESS 25 Agustus 2026)

```
users, roles, user_roles, crew
stores, store_assignments, store_schedules
events, event_locations, event_assignments, event_schedules
attendance_logs, attendance_corrections, permissions, overtimes
equipment_assets, event_asset_assignments, event_checklists, inspection_reports
audit_logs, notifications
```
