# Model Akun: Admin vs Crew

## Cara kerjanya sekarang

**1. Akun admin sudah ada di sistem sejak awal (lewat seed SQL).**

`database/seeds/001_roles_and_tenants.sql` — sekarang HANYA berisi role, tenant, dan **satu** akun admin (`admin@fotosnaps.id`, role `SUPER_ADMIN`, terdaftar di kedua tenant Bujangan Food & FotoSnaps). Ini seed yang **wajib** dijalankan, termasuk nanti di produksi — karena harus ada satu admin yang bisa login duluan untuk membuat akun-akun lain.

Akun demo crew (Rummy, Budi) sudah **dipindah** ke file terpisah: `database/seeds/002_demo_accounts_OPTIONAL.sql` — jelas ditandai opsional, hanya untuk testing lokal, jangan dijalankan di database produksi.

**2. Akun crew dibuat & dikelola admin lewat halaman Kelola Crew.**

Sebelumnya, tombol "Simpan Crew" di halaman itu cuma UI kosong (`onClick={() => setShowModal(false)}`, tidak ngapa-ngapain). Sekarang:

- Form "Tambah Crew" mengirim `POST /crew` ke backend.
- Backend (`backend/src/modules/crew/crew.controller.js`) membuat **3 baris sekaligus** dalam satu aksi:
  1. `users` — akun login (email + password di-hash pakai bcrypt)
  2. `user_tenants` — mengaitkan user itu ke tenant admin yang login, dengan role `CREW_EVENT` atau `CREW_STORE` sesuai jenis crew yang dipilih
  3. `crew` — profil pekerja (kode karyawan, gaji pokok, status)
- Begitu admin klik simpan, crew itu **langsung bisa login** pakai email+password yang admin masukkan tadi — tidak perlu proses seed manual lagi.
- Tombol nonaktifkan/aktifkan di tabel memanggil `PATCH /crew/:id` untuk mengubah status tanpa menghapus akun (soft-disable, sesuai prinsip "jangan hard-delete data operasional" di PRD).

## Kenapa dipisah gini (bukan taruh semua di seed)?

Karena kalau semua akun crew ditaruh di seed SQL:
- Setiap ada crew baru, harus edit file SQL & jalankan manual — tidak praktis untuk operasional harian.
- Tidak ada jejak siapa yang membuat akun itu, kapan (audit log kosong).
- Password di SQL rawan ke-commit ke Git kalau tidak hati-hati.

Dengan lewat UI, semuanya tercatat di `audit_logs` (aksi `CREW_CREATED`, `CREW_UPDATED`, `CREW_PASSWORD_RESET`) dan sesuai alur kerja yang wajar: admin yang berwenang menentukan siapa saja yang boleh punya akun.

## Kalau database kamu sudah terlanjur jalan (seperti kasus kamu)

Kamu sudah pernah menjalankan `run_all.sql` versi lama. Supaya update ini kepakai, jalankan patch kecil ini di SQL Editor:

```sql
-- 1) Tambah kolom base_salary yang belum ada di database lama
alter table crew add column if not exists base_salary numeric(12, 2) not null default 0;
```

Data admin & demo crew yang sudah ada di database kamu **tidak perlu dihapus** — tetap bisa dipakai untuk testing. Mulai sekarang, kalau mau tambah crew baru, pakai halaman Kelola Crew (bukan edit SQL lagi).

## Reset password crew yang lupa password

Endpoint baru: `PATCH /crew/:id/reset-password` dengan body `{ "newPassword": "..." }` — panggil ini dari halaman Kelola Crew (tombol reset password belum ada di UI, bisa ditambahkan kalau dibutuhkan; untuk sekarang bisa dites langsung lewat Postman/curl oleh admin).
