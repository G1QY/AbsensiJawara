# Setup Supabase untuk JAWARA

Panduan aktif, 5 Oktober 2026. Environment/deployment: [SETUP](SETUP.md). SQL: [panduan database](../supabase/README.md).

## Prasyarat

- Project database/Auth sesuai environment aplikasi.
- Schema, trigger profil, role, tabel, fungsi dan grant sesuai commit backend.
- `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` pada backend.
- Bucket private serta credential S3-compatible.
- Admin awal melalui Auth Admin API, bukan insert password manual SQL.

## Database existing

Baca schema/riwayat sebelum perubahan. Jangan menjalankan reset, seed akun demo atau SQL multi-tenant dari PRD lama pada data operasional. Riwayat tidak lengkap bukan bukti objek belum dibuat.

## Database baru/lokal

Repository memiliki konfigurasi lokal, tetapi SQL dasar dan migrasi lanjut masih bercampur. Uji baseline terisolasi sebelum bootstrap. Tidak ada `database/run_all.sql` aktif atau prosedur satu perintah yang dijamin membangun seluruh aplikasi.

Setelah schema dan role siap, gunakan [panduan akun](ADMIN_CREW_ACCOUNTS.md). Seed tidak membuat pengguna Auth.

## Storage dan email

Kode memakai S3 SDK. Ambil endpoint, region dan credential dari penyedia bucket tujuan; cocokkan `S3_BUCKET_NAME`. Key S3 berbeda dari service-role key. Uji upload dan signed download secara terpisah.

OTP aplikasi dikirim backend melalui Resend. Pengaturan email Supabase Auth saja tidak menggantikan `RESEND_API_KEY` dan `OTP_EMAIL_FROM`.

## Verifikasi

Health backend hanya memeriksa proses. Uji login, query/RPC, upload/download dan scope role sebelum menyatakan integrasi siap. Kuota, biaya dan backup mengikuti layanan/plan; dokumen ini tidak menjamin angka biaya atau backup otomatis.
