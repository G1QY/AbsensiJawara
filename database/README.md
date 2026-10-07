# Berkas database historis

Diperbarui 5 Oktober 2026.

Folder ini bukan sumber migrasi utama JAWARA. `migrations/20260826_password_reset_otps.sql` dipertahankan sebagai jejak perubahan lama; jangan menjalankan folder ini bersama semua SQL Supabase sebagai installer otomatis.

Gunakan [panduan database](../supabase/README.md) dan [PRD aktif](../docs/PRD_ERD_CURRENT.md).

Arsitektur memisahkan database per perusahaan. Source inventory Bujangan Food berada di `backend/src/modules/inventory/` tetapi tidak di-mount. Pengembangannya membutuhkan keputusan scope dan database tersendiri; berkas source bukan bukti fitur aktif.
