-- =====================================================================
-- 006_attendance_calendar_fields.sql — FotoSnaps DB
-- Menyesuaikan attendance_logs dengan flow final di REPORT_PROGRESS
-- 25 Agustus 2026 (Section 8, 11, 13, 14):
--   - status diperluas untuk kebutuhan Kalender Kerja
--   - overtime_minutes & overtime_status disiapkan (aturan nominal masih
--     menunggu keputusan bos — lihat backend/src/modules/attendance/attendance.controller.js)
-- =====================================================================

-- Ganti constraint status lama (ON_TIME/LATE/ABSENT/PENDING) dengan set baru
-- sesuai Section 14: PRESENT, LATE, ABSENT, PERMISSION, SICK, HOLIDAY,
-- NOT_SCHEDULED, PENDING. ON_TIME -> PRESENT.
update attendance_logs set status = 'PRESENT' where status = 'ON_TIME';

alter table attendance_logs drop constraint if exists attendance_logs_status_check;
alter table attendance_logs add constraint attendance_logs_status_check
  check (status in ('PRESENT', 'LATE', 'ABSENT', 'PERMISSION', 'SICK', 'HOLIDAY', 'NOT_SCHEDULED', 'PENDING'));

alter table attendance_logs alter column status set default 'PENDING';

-- Field lembur (Section 13) — dihitung otomatis saat Clock Out memakai
-- aturan sementara "harus mencapai jam penuh", TAPI berstatus PENDING
-- (butuh approval admin), bukan langsung APPROVED, karena nominal &
-- kebijakan final belum dikunci perusahaan.
alter table attendance_logs add column if not exists overtime_minutes integer not null default 0;
alter table attendance_logs add column if not exists overtime_status varchar(20) not null default 'NONE'
  check (overtime_status in ('NONE', 'PENDING', 'APPROVED', 'REJECTED'));

comment on column attendance_logs.overtime_minutes is
  'Dihitung otomatis dari selisih check_out - jadwal selesai, DIBULATKAN KE BAWAH per jam penuh (aturan sementara, lihat Section 13 report 25 Agustus 2026).';
comment on column attendance_logs.overtime_status is
  'NONE = tidak ada lembur. PENDING = lembur terdeteksi, menunggu approval admin. Nominal upah lembur belum diimplementasikan (menunggu keputusan bos).';
