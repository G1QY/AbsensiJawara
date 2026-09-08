# REPORT PROGRESS DEVELOPMENT
## FotoSnaps System Fullstack
Tanggal: 25 Agustus 2026

## 1. Status Project

Infrastructure sudah berjalan.

```text
Supabase Local       ✅ Running
PostgreSQL           ✅ Running
Supabase Studio      ✅ Running
Realtime             ✅ Healthy
Storage              ✅ Healthy
Auth                 ✅ Healthy
REST API             ✅ Running
Docker               ✅ Running
```

Akses local:

```text
Studio:   http://127.0.0.1:54323
API:      http://127.0.0.1:54321
Database: 127.0.0.1:54322
```

Masalah health check Supabase sebelumnya sudah teratasi untuk development. Fokus sekarang berpindah ke migration, backend, authentication, dan attendance.

## 2. Arsitektur Final

```text
                    CREWFLOW
                       │
          ┌────────────┴────────────┐
          │                         │
     FotoSnaps.id             BujanganFood.id
          │                         │
       Frontend                  Frontend
          │                         │
          └────────────┬────────────┘
                       │
                  Backend/API
                       │
              ┌────────┴────────┐
              │                 │
        FotoSnaps DB       Bujangan DB
```

Kedua website menggunakan database terpisah.

Tidak menggunakan `tenant_id` sebagai pemisah perusahaan.

## 3. Role

Kedua perusahaan memiliki:

```text
CREW_STORE
CREW_EVENT
```

Role:

```text
SUPER_ADMIN
ADMIN_STORE
CREW_STORE
EVENT_MANAGER
CREW_EVENT
```

## 4. Migration

Migration Claude lama masih menggunakan konsep shared tenant database.

Mapping final:

```text
001_foundation.sql
→ FotoSnaps foundation

002_attendance.sql
→ FotoSnaps workforce + attendance

003_inventory_bujangan_food.sql
→ Bujangan Food database

004_equipment_fotosnaps.sql
→ FotoSnaps equipment

005_rls_helper_function.sql
→ Tidak digunakan untuk pemisahan tenant
```

Migration final FotoSnaps:

```text
supabase/
├── config.toml
├── migrations/
│   ├── 001_foundation.sql
│   ├── 002_workforce.sql
│   ├── 003_attendance.sql
│   ├── 004_equipment.sql
│   └── 005_audit_rls.sql
└── seed.sql
```

## 5. Database FotoSnaps

```text
users
roles
user_roles
crew

stores
store_assignments
store_schedules

events
event_locations
event_assignments
event_schedules

attendance_logs
attendance_corrections
permissions
overtimes

equipment_assets
event_asset_assignments
event_checklists
inspection_reports

notifications
audit_logs
```

FotoSnaps tetap memiliki Crew Store dan Crew Event.

## 6. Database Bujangan Food

```text
users
roles
user_roles
crew

stores
store_assignments
store_schedules

events
event_locations
event_assignments
event_schedules

attendance_logs
attendance_corrections
permissions
overtimes

inventory_items
inventory_stocks
stock_opname_logs
waste_logs

notifications
audit_logs
```

Inventory Bujangan Food tetap berada di database Bujangan Food, bukan FotoSnaps.

## 7. Status Attendance Saat Ini

UI attendance sudah tersedia, tetapi belum selesai secara end-to-end.

Kondisi:

```text
Crew Store
→ UI sudah ada
→ flow masih perlu dibenahi
→ sebagian masih dummy

Crew Event
→ UI sudah ada
→ belum menggunakan flow final secara penuh
```

Masalah yang ditemukan:

```text
1. Clock In belum menjadi state machine penuh.
2. Clock Out belum finalisasi attendance end-to-end.
3. Riwayat belum otomatis mengambil data baru dari database.
4. Kalender kerja belum tersedia.
5. Tanggal pada UI masih terlihat memakai data lama/hardcoded.
6. Aturan payroll masih menunggu keputusan perusahaan.
```

## 8. Flow Absensi Final

```text
NOT_STARTED
      ↓
CLOCK IN
      ↓
GPS
      ↓
Geofence
      ↓
Live Selfie
      ↓
Server Timestamp
      ↓
WORKING
      ↓
CLOCK OUT
      ↓
GPS
      ↓
Live Selfie
      ↓
Server Timestamp
      ↓
COMPLETED
      ↓
Riwayat
      ↓
Kalender
```

State:

```text
NOT_STARTED
CLOCK_IN_PROCESS
WORKING
CLOCK_OUT_PROCESS
COMPLETED
```

## 9. Clock In

Flow:

```text
Validasi assignment
↓
Validasi schedule
↓
GPS
↓
Validasi radius
↓
Live camera
↓
Konfirmasi
↓
Simpan attendance
```

Data:

```text
check_in
check_in_lat
check_in_lng
check_in_distance_m
check_in_photo_url
status
late_minutes
```

## 10. Clock Out

Flow:

```text
GPS
↓
Validasi radius
↓
Live camera
↓
Konfirmasi
↓
Simpan check_out
↓
Hitung durasi
↓
Hitung overtime eligibility
↓
COMPLETED
↓
Refresh riwayat
```

## 11. Aturan Keterlambatan Sementara

Aturan final payroll belum dikunci.

Jadwal contoh:

```text
09:00 - 18:00
```

Clock In:

```text
08:59 → Tepat waktu
09:00 → Tepat waktu
09:01 → Terlambat
09:45 → Terlambat 45 menit
```

Untuk saat ini sistem hanya wajib menyimpan:

```text
late_minutes
```

Nominal potongan dan pembulatannya menunggu keputusan bos.

## 12. Aturan Clock Out Sementara

Clock out setelah jam selesai tidak otomatis berarti lembur.

Contoh:

```text
Jadwal: 09:00 - 18:00

18:00 → Clock out normal
18:02 → Clock out normal
18:05 → Clock out normal
18:30 → Clock out normal
```

Jadi:

```text
Clock Out > schedule_end
≠ otomatis lembur
```

## 13. Aturan Lembur Sementara

Aturan final masih menunggu konfirmasi.

Data yang dipersiapkan:

```text
overtime_minutes
overtime_status
```

Status:

```text
NONE
PENDING
APPROVED
REJECTED
```

Asumsi sementara untuk desain:

```text
Lembur harus mencapai jam penuh.
```

Contoh sementara:

```text
18:02 → 0 jam lembur
18:30 → 0 jam lembur
18:59 → 0 jam lembur
19:00 → eligible 1 jam
```

Ini belum menjadi aturan payroll final.

## 14. Kalender Kerja

Kalender harus ada pada halaman Absensi.

Tampilkan:

```text
Tanggal
Jadwal
Jam Mulai
Jam Selesai
Store/Event
Status Attendance
Clock In
Clock Out
Durasi
Keterlambatan
Lembur
```

Status:

```text
PRESENT
LATE
ABSENT
PERMISSION
SICK
HOLIDAY
NOT_SCHEDULED
PENDING
```

Tanggal yang dipilih harus menampilkan detail jadwal dan absensi.

## 15. Riwayat Absensi

Setelah Clock Out sukses:

```text
Clock In
Clock Out
Durasi
Status
Late Minutes
Overtime
```

Data langsung disimpan pada:

```text
attendance_logs
```

Database menjadi source of truth.

LocalStorage tidak boleh menjadi sumber utama attendance.

## 16. Endpoint yang Dibutuhkan

```http
POST /api/attendance/check-in
POST /api/attendance/:id/check-out
GET  /api/attendance
GET  /api/attendance/calendar?month=YYYY-MM
GET  /api/attendance/:id

POST  /api/attendance-corrections
GET   /api/attendance-corrections
PATCH /api/attendance-corrections/:id

POST  /api/permissions
GET   /api/permissions
PATCH /api/permissions/:id

POST  /api/overtimes
GET   /api/overtimes
PATCH /api/overtimes/:id
```

## 17. Pembagian Tim

### Tim Attendance

```text
backend/modules/attendance
backend/modules/stores
backend/modules/events
```

Frontend:

```text
attendance
calendar
crew
store
event
schedule
permission
correction
```

### Tim Inventory

```text
backend/modules/inventory
backend/modules/equipment
```

Frontend:

```text
inventory
stock opname
waste
equipment
asset
```

### Shared/Core

```text
auth
users
roles
notifications
audit
shared types
```

## 18. Pertanyaan yang Harus Dikonfirmasi ke Bos

### Keterlambatan

1. Apakah 09:01 langsung dianggap terlambat?
2. Apakah ada toleransi?
3. Potongan dihitung per menit atau per jam?
4. Bagaimana pembulatannya?
5. Berapa nominal potongan?

### Lembur

1. Apakah 18:02 tetap clock out normal?
2. Mulai kapan lembur dihitung?
3. Apakah minimal 1 jam?
4. 1 jam 30 menit dihitung 1 atau 2 jam?
5. Apakah lembur memerlukan approval?
6. Berapa nominal lembur per jam?

Nominal dan pembulatan payroll jangan dikunci sebelum ada keputusan resmi.

## 19. Status Progress

Estimasi:

```text
Infrastructure       [██████████] 100%
Supabase local       [██████████] 100%
Arsitektur           [██████████] 100%
ERD Master           [█████████░] 90%
Migration FotoSnaps  [████████░░] 80%
Backend API          [███░░░░░░░] 30%
Authentication       [██░░░░░░░░] 20%
Frontend real data   [█░░░░░░░░░] 10%
Attendance flow      [███░░░░░░░] 30%
Calendar             [░░░░░░░░░░] 0%
Dummy removal        [░░░░░░░░░░] 0%
Production           [░░░░░░░░░░] 0%
```

## 20. Prioritas Pengerjaan Sekarang

```text
1. Finalisasi migration FotoSnaps
2. supabase db reset
3. Verifikasi tabel
4. Verifikasi RLS
5. Backend connect ke Supabase
6. Authentication
7. Crew
8. Store dan Event assignment
9. Schedule
10. Clock In
11. Clock Out
12. Riwayat
13. Kalender
14. Hubungkan Crew Store
15. Hubungkan Crew Event
16. Pindahkan frontend dari dummy ke API
17. Hapus dummy
18. Implement payroll setelah aturan bos final
```

## 21. Target Tahap Attendance

```text
✅ Crew Store bisa login
✅ Crew Event bisa login
✅ Crew melihat jadwal
✅ Crew melihat lokasi kerja
✅ Crew bisa Clock In
✅ GPS tervalidasi
✅ Geofence tervalidasi
✅ Live selfie tersimpan
✅ Server timestamp digunakan
✅ Late minutes otomatis dihitung
✅ Crew bisa Clock Out
✅ Clock Out normal tidak salah dianggap lembur
✅ Riwayat otomatis diperbarui
✅ Kalender menampilkan jadwal
✅ Kalender menampilkan status
✅ Data berasal dari database
✅ Dummy attendance tidak digunakan
```

## 22. Target Arsitektur Akhir

```text
                    CREWFLOW
                       │
          ┌────────────┴────────────┐
          │                         │
     FOTOSNAPS.ID             BUJANGANFOOD.ID
          │                         │
          ▼                         ▼
     FotoSnaps DB             Bujangan DB
          │                         │
     ┌────┴────┐               ┌────┴────┐
     │         │               │         │
 Attendance  Equipment      Attendance Inventory
     │                         │
 Crew Store                Crew Store
 Crew Event                Crew Event
```

## 23. Fokus Saat Ini

Fokus developer sekarang:

```text
DATABASE
    ↓
BACKEND
    ↓
AUTH
    ↓
CREW
    ↓
SCHEDULE
    ↓
CLOCK IN
    ↓
CLOCK OUT
    ↓
HISTORY
    ↓
CALENDAR
    ↓
FRONTEND REAL DATA
```

Aturan payroll ditahan sampai keputusan resmi perusahaan diterima.
