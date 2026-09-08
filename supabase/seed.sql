-- =====================================================================
-- supabase/seed.sql
-- Dijalankan otomatis oleh `supabase db reset` setelah semua migration.
--
-- HANYA berisi role baku — aman & valid dijalankan pakai SQL biasa.
--
-- Akun admin TIDAK dibuat di sini, karena password sekarang dikelola
-- Supabase Auth (bukan kolom password_hash biasa) — insert langsung ke
-- auth.users lewat SQL itu rapuh (banyak kolom wajib internal GoTrue
-- yang bisa beda antar versi). Cara yang benar & didukung resmi: pakai
-- Admin API lewat service role key.
--
-- Setelah `supabase db reset` selesai, jalankan:
--   node database/bootstrap-admin.js
-- untuk membuat akun SUPER_ADMIN pertama.
-- =====================================================================

insert into roles (code, name, description) values
  ('SUPER_ADMIN',   'Super Admin',    'Akses penuh — kelola crew, store, event, konfigurasi, audit'),
  ('ADMIN_STORE',   'Admin Store',    'Kelola store, crew, shift, absensi, approval'),
  ('CREW_STORE',    'Crew Store',     'Absensi, checklist, stock opname, waste'),
  ('EVENT_MANAGER', 'Event Manager',  'Kelola event, equipment, assignment, checklist, approval, PDF report'),
  ('CREW_EVENT',    'Crew Event',     'Absensi event, PRE/POST checklist, evidence foto')
on conflict (code) do nothing;
