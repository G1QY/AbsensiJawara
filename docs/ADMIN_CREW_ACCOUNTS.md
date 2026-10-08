# Akun, role dan password JAWARA

Panduan aktif, diperbarui 8 Oktober 2026 sesuai alur akun dan lokasi absensi di repository.

## Identitas dan sesi

Supabase Auth mengelola kredensial login. `public.users` menyimpan profil dengan ID sama dengan `auth.users`, `user_roles` menghubungkannya ke `roles`, dan `crew` menyimpan personel. Tidak ada seed akun admin bawaan, kolom password_hash aplikasi atau keanggotaan tenant yang perlu diisi.

Sesi frontend berada di memori halaman. Refresh/tab baru meminta login ulang, termasuk Guest. Preferensi browser bukan bukti login. Backend memeriksa token, status akun dan hak akses.

## Membuat Super Admin pertama

Pastikan skema/trigger profil serta role `SUPER_ADMIN` tersedia; baca [panduan database](../supabase/README.md). Isi URL Supabase dan service-role key di `backend/.env`, lalu jalankan dari backend:

```powershell
npm run bootstrap-admin
```

Script meminta email, nama dan password minimal delapan karakter, membuat pengguna melalui Auth Admin API, lalu mengaitkan role. Prompt password terminal biasa menampilkan input saat diketik; gunakan terminal privat. Jalankan untuk bootstrap pertama, bukan setiap deployment.

Jika Auth berhasil dibuat tetapi pemasangan role gagal, periksa pengguna yang sudah terbentuk sebelum mencoba email yang sama. Script tidak menjamin rollback semua langkah. Gunakan admin existing bila sudah tersedia.

## Personel dan hak akses

1. Super Admin membuat personel di **Kelola Crew** dengan email, password awal, profil dan jenis crew.
2. Backend membuat pengguna Auth kemudian menjalankan RPC personel. Bila RPC awal gagal, backend mencoba membatalkan pengguna Auth baru.
3. Pilih **Crew Store**, **Kantor**, atau **Crew Event** pada Jenis Penugasan. Store/Kantor menampilkan lokasi aktif sesuai jenis dan cabangnya; jadwal dikelola dari Kelola Crew. Penugasan/PIC Event melalui **Kelola Event**; event acuan kode personel tidak otomatis menjadi penugasan.
4. Role, divisi, cakupan Head Store dan kontrol password berada di **Akun & Hak Akses**.
5. Login ulang setelah perubahan role agar workspace sesuai akses baru.

| Role | Cakupan utama |
| --- | --- |
| `SUPER_ADMIN` | Personel/akun, direktori, absensi, event, payroll dan audit global; tidak melakukan absensi pribadi. |
| `HEAD_STORE` | Monitoring kota yang ditugaskan dan data pribadi. `ADMIN_STORE` lama dibatasi workspace ini. |
| `EVENT_MANAGER` | Operasional event, crew event, review absensi event dan data pribadi; tidak mengatur akun global atau finalisasi/pembayaran payroll. |
| `HEAD_OFFICE`, `OFFICE_STAFF`, `PRODUCTION_STAFF` | Workspace pekerjaan, absensi, riwayat dan payroll pribadi. |
| `CREW_STORE`, `CREW_EVENT` | Data pribadi dan pekerjaan/penugasan terkait. |
| Guest | Pengajuan tanpa token Supabase Auth; tidak mendapat akses API karyawan. |

Divisi Finance adalah label profil, bukan izin payroll. Akses ditentukan middleware, pembatas workspace dan RPC; jangan menyimpulkan izin hanya dari tombol atau requireRole satu router.

## Absensi dari mana saja

Super Admin membuka **Kelola Crew → Detail → Edit → Lokasi absensi**, memilih **Semua lokasi — GPS tetap dicatat**, lalu menyimpan crew. Pengaturan berlaku untuk clock in dan clock out orang tersebut, termasuk penugasan Kantor. Pilihan awal tetap **Sesuai radius lokasi penugasan**.

Crew tetap membutuhkan penugasan dan jadwal aktif, izin GPS, serta foto kamera. Libur/izin yang disetujui tetap memblokir clock in. Admin melihat koordinat, tautan peta, jarak dari lokasi penugasan, dan mode lokasi pada detail absensi. Koordinat merupakan lokasi yang dilaporkan perangkat saat absen; fitur ini bukan pelacakan terus-menerus.

Contoh: personel ditugaskan di kantor Bandung tetapi sedang di Jogja. Dengan mode Semua lokasi, jadwal kantor tetap digunakan dan titik GPS Jogja dicatat. Setelah kembali ke mode radius, clock in/out berikutnya harus berada dalam radius kantor. Perubahan mode tidak mengubah catatan absensi sebelumnya.

Jenis Kantor disimpan sebagai `assignment_kind=OFFICE` dengan `crew_type=CREW_STORE` untuk mempertahankan alur jadwal/payroll. Role akun tetap terpisah; memilih Kantor tidak otomatis mengangkat crew menjadi Head Office atau Staff Kantor. Perubahan jenis/penempatan mengakhiri penugasan sebelumnya tanpa menghapus riwayat, dan jadwal baru perlu dibuat.

Foto profil ditampilkan pada daftar dan detail crew melalui signed URL storage private. Crew tanpa foto atau foto yang gagal dimuat menggunakan inisial.

## Password

- Pemulihan mandiri: lupa password → OTP email → verifikasi → password baru, melalui `/api/auth/*`.
- Pengaturan admin: kontrol Password akun memanggil route reset dengan validasi target. Akun sendiri/Super Admin tidak dapat diubah sembarang melalui route crew.
- Lihat salinan: khusus Super Admin, `POST /api/crew/:id/reveal-password`. Salinan berasal dari pembuatan/reset admin yang ditangkap aplikasi, bukan pembacaan hash Auth atau password saat login.
- Salinan AES-256-GCM pada schema private membutuhkan `CREW_PASSWORD_VAULT_KEY` berisi 32 byte Base64. Mengganti kunci tanpa migrasi membuat salinan lama tidak terbaca.
- Password lama/sebelum fitur aktif atau yang diganti pemilik dapat tidak tersedia. UI menyembunyikan hasil setelah 30 detik/saat blur; password tidak untuk ekspor.

## Status dan penghapusan

Perubahan status, pengarsipan dan penghapusan mempunyai aturan berbeda. Route penghapusan khusus Super Admin memiliki validasi backend/database. Jangan menyamakan perubahan status dengan hard delete atau menghapus Auth/profil manual untuk mengganti alur UI.

## Sumber

[Auth controller](../backend/src/modules/auth/auth.controller.js), [AuthContext](../frontend/src/lib/AuthContext.tsx), [bootstrap](../backend/scripts/bootstrap-admin.js), [crew controller](../backend/src/modules/crew/crew.controller.js), [role](../backend/src/modules/accounts/accounts.routes.js), [vault](../backend/src/modules/crew/passwordVault.js), [Head Store/staff boundary](../backend/src/security/headStore.js), [Event Manager boundary](../backend/src/security/eventManager.js).
