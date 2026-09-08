# FotoSnaps. Scope rilis 2 hari

Versi ini sengaja mengaktifkan fitur yang sudah memakai data Supabase nyata.

## Fitur aktif

1. Login Supabase Auth.
2. Role dari `user_roles` dan `roles`.
3. Admin melihat, menambah, dan mengubah crew.
4. Admin melihat dan meninjau absensi.
5. Crew Store dan Crew Event melakukan check-in serta check-out dengan GPS dan foto.
6. Crew melihat riwayat absensi miliknya.
7. Foto tersimpan di bucket privat `fotosnaps-private`.
8. Lupa sandi memakai OTP ter-hash.

## Fitur yang ditunda

Dashboard ringkasan, payroll, laporan, audit UI, inventory, integrasi guest ke database, detail event, dan workflow operasional belum selesai. Data dummy lama masih dipertahankan sebagai referensi desain. Portal guest masih memiliki data contoh event dan memerlukan penyelesaian terpisah.

## Urutan setup

1. Buat project Supabase.
2. Isi `backend/.env` berdasarkan `backend/.env.example`.
3. Jalankan seluruh migration dalam `supabase/migrations` sesuai urutan.
4. Jalankan `supabase/seed.sql` untuk role dan data referensi awal.
5. Jalankan `npm install` di folder `backend` dan `frontend`.
6. Jalankan `npm run bootstrap-admin` di folder `backend`.
7. Jalankan backend dengan `npm start`.
8. Isi `frontend/.env` dengan URL backend.
9. Jalankan frontend dengan `npm run dev`.

## Login dan pembuatan akun

Perbaikan 31 Agustus 2026: sesi login hanya berada di memori halaman. Membuka URL kembali, tab baru, atau refresh akan meminta login ulang, termasuk Guest Crew. Perpindahan menu dalam aplikasi tidak mengeluarkan pengguna. Aplikasi menghapus key sesi lama `fotosnaps_auth`, tanpa menghapus data browser lainnya atau akun database. Token tetap diperiksa oleh backend pada setiap request terlindungi. Reset halaman ini bukan pencabutan token Supabase di server.

1. Di bawah tombol login hanya terdapat tombol Guest Crew. Tidak ada shortcut akun uji.
2. Jika admin belum ada, jalankan `npm run bootstrap-admin` satu kali. Jika sudah ada, gunakan akun tersebut.
3. Login sebagai admin, buka Kelola Crew, lalu Tambah Crew.
4. Isi identitas asli, email, password awal minimal 8 karakter, kode karyawan unik, serta jenis Crew Event atau Crew Store.
5. Backend membuat akun Supabase Auth, profil, role, dan data crew. Crew login memakai email dan password tersebut.
6. Script pembuat akun demo telah dihapus. Akun yang sudah pernah dibuat di database tidak otomatis terhapus. Jangan menghapus satu-satunya admin.

Guest Crew tetap tersedia tanpa banner. Portal guest saat ini menyimpan laporan pada browser, belum menjadi absensi resmi di database. Penyelesaian modul guest dibahas terpisah.

## Email OTP

1. Buat API key pada Resend.
2. Verifikasi domain pengirim pada Resend.
3. Isi `RESEND_API_KEY` dan `OTP_EMAIL_FROM` pada `backend/.env`.
4. Terapkan migration `008_password_reset_and_storage.sql` dan `009_secure_password_reset.sql`.
5. Pastikan `ENABLE_DEV_OTP=false` agar kode tidak ditampilkan pada layar.
6. Restart backend setelah mengubah `.env`.

API key diperoleh di https://resend.com/api-keys melalui Create API Key. Pilih izin Sending access. Simpan nilai yang ditampilkan ke `RESEND_API_KEY`.

Untuk tes ke email pemilik akun Resend, pengirim dapat menggunakan `FotoSnaps <onboarding@resend.dev>`. Untuk mengirim ke email crew lain, verifikasi domain milik Anda di Resend dan gunakan alamat pengirim dari domain tersebut. Jangan mengisi domain contoh seolah sudah terverifikasi.

Referensi: https://resend.com/docs/create-an-api-key dan https://resend.com/docs/knowledge-base/403-error-resend-dev-domain.

## Key S3 untuk foto absensi

Buka https://supabase.com/dashboard/project/_/storage/s3 lalu pilih project FotoSnaps. Buat pasangan S3 Access Key ID dan Secret Access Key. Salin endpoint dan region dari halaman yang sama.

- `S3_ACCESS_KEY_ID`: Access Key ID.
- `S3_SECRET_ACCESS_KEY`: Secret Access Key.
- `S3_ENDPOINT`: endpoint S3 yang ditampilkan Supabase.
- `S3_REGION`: region project, misalnya `ap-southeast-1` untuk Singapore.
- `S3_BUCKET_NAME`: `fotosnaps-private`, pastikan bucket berstatus private.

Ini berbeda dari key Supabase Auth/Data API. Semua key rahasia hanya di `backend/.env`, tidak di frontend.

Referensi: https://supabase.com/docs/guides/storage/s3/authentication.

Alur reset password:

1. Pengguna memasukkan email.
2. Backend membuat OTP dan mengirimkannya melalui email.
3. Pengguna memasukkan OTP.
4. Backend memverifikasi OTP dan menerbitkan token reset satu kali.
5. Form password baru ditampilkan.
6. Backend mengganti password melalui Supabase Auth Admin API.

## Uji penerimaan wajib

Tes regresi lokal (Node.js 22.13+ atau 24, tanpa instalasi dependency), jalankan dari folder frontend:

```bash
node --experimental-vm-modules --test tests/auth-session.test.mjs
```

Tes ini mencakup sesi memori dan API memakai server tiruan, ditambah pemeriksaan integrasi sumber React. Tetap lakukan uji browser: buka aplikasi dengan sesi lama, login admin/crew, refresh, login Guest, refresh, dan logout. Setiap pembukaan ulang harus menampilkan Login. Setelah login crew, halaman admin tidak boleh sempat dimuat.

1. Password salah menghasilkan HTTP 401.
2. Akun tanpa role menghasilkan HTTP 403.
3. Admin dapat membuat crew baru. Crew baru dapat login.
4. Crew tidak dapat mengirim absensi untuk `crewId` milik pengguna lain.
5. Check-in di luar radius ditolak.
6. Check-in tanpa foto ditolak.
7. Check-in valid membuat baris `attendance_logs` dan objek foto pada bucket privat.
8. Check-out kedua pada absensi yang sama ditolak.
9. Crew hanya melihat riwayat miliknya.
10. Admin dapat melihat seluruh absensi.

## Batas siap pakai

Jangan menganggap menu yang ditunda sudah siap pakai. Guest tidak memiliki token Auth dan laporannya belum menjadi absensi resmi database. Jangan memakai nilai placeholder `.env.example` untuk production.

## Menjalankan versi perbaikan login di Windows

1. Hentikan frontend dengan Ctrl+C. Salin file perbaikan dari ZIP ke folder proyek yang sama. Pertahankan kedua file `.env` milik Anda.
2. Frontend default berjalan di `http://localhost:8443`, bukan port backend 4000.
3. Pada `backend/.env`, pastikan `CORS_ORIGIN=http://localhost:8443,http://localhost:5173`. Contoh ini hanya mengizinkan origin lokal tersebut. Untuk akses dari HP/LAN, tambahkan origin frontend yang benar secara eksplisit.
4. Terminal backend: jalankan `npm start` dari folder backend. Restart setelah mengubah `.env`.
5. Terminal frontend: jalankan `npm run dev` dari folder frontend. Tidak perlu menginstal ulang dependency untuk patch ini.
6. Buka `http://localhost:8443`. Cek backend terpisah di `http://localhost:4000/health`.
7. Jika sesudah login tetap muncul gagal memuat crew, periksa Network browser dan terminal backend. Jangan menganggap semua kegagalan berasal dari CORS.

`<pkg>` pada bantuan npm berarti nama paket pengganti, bukan teks yang diketik. `npm install-scripts ls` hanya menampilkan daftar. Jangan menyetujui seluruh script untuk mengatasi masalah login. Log Vite ready berarti dev server sudah berjalan; peringatan install script tidak menyebabkan sesi otomatis masuk. Referensi: https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/.

File patch login: `frontend/src/lib/authSession.ts` (baru), `frontend/src/lib/AuthContext.tsx`, `frontend/src/lib/apiClient.ts`, `frontend/src/App.tsx`, `frontend/vite.config.ts`. Tes ada di `frontend/tests/auth-session.test.mjs`. Contoh CORS diperbarui di `backend/.env.example`, bukan file `.env` Anda.
