-- Tambah kolom foto device mati pada attendance_logs.
-- Dipakai saat crew clock out memakai device crew lain
-- karena device aslinya mati. Foto device mati diambil
-- sebelum clock out sebagai bukti.

alter table attendance_logs
  add column if not exists dead_device_photo_url text,
  add column if not exists dead_device_note text;
