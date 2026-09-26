# V12: Password khusus Super Admin dan role langsung di Detail Crew

Pembaruan ini melanjutkan paket V11, commit 8c0e52d86e93a6d6562087a919cbcdae79b5cf84. Source lengkap menyertakan V11. Patch V12 hanya memuat perubahan sejak commit tersebut.

## Penggunaan

Super Admin membuka Kelola Crew → Detail → Akun & Hak Akses.

- Tampilkan password membuka salinan yang tersedia. Tidak memuat password otomatis saat daftar atau detail dibuka.
- Password disembunyikan setelah 30 detik, saat jendela kehilangan fokus, saat dialog ditutup, atau ketika beralih ke aksi lain.
- Role lain tidak melihat kontrol ini. API dan RPC juga menolak akses mereka.
- Ubah role menyediakan Crew Store, Crew Event, Head Store, Event Manager dan Super Admin. Head Store wajib memilih satu kota.
- Super Admin dapat mengedit profil, status, gaji, email dan password akun Head Store atau Event Manager melalui Kelola Crew. Edit profil mempertahankan role akun dan kota cakupannya. Jenis penugasan yang terkunci harus diubah melalui Ubah role.
- Akun Super Admin serta akun sendiri tetap terlindungi dari edit melalui Kelola Crew.

## Password yang tersedia

Salinan hanya dibuat dari password yang memang dimasukkan ketika membuat akun atau menggunakan Atur Password melalui admin, setelah fitur dan kunci server aktif. Akun lama tidak memiliki salinan. Password tidak dipulihkan dari hash dan tidak dikumpulkan saat login.

Jika crew mengganti password melalui Lupa Password atau melalui Supabase secara langsung, trigger menghapus salinan lama. Detail menunjukkan Belum tersedia. Ini mencegah tampilan password yang sudah tidak berlaku. Menyediakan kembali salinan memerlukan Atur Password oleh admin. Akun Supabase tetap berfungsi bila penyimpanan salinan gagal; respons memberi passwordNotice, bukan mengulang pembuatan akun atau mengaku reset gagal.

Password memakai AES-256-GCM, nonce acak, dan AAD ID pengguna. Ciphertext hanya disimpan dalam schema private. Kunci tidak disimpan di database, metadata pengguna, frontend, ekspor, atau log. Setiap permintaan pembukaan dicatat di audit tanpa password/ciphertext. Endpoint POST tidak boleh di-cache dan dibatasi 10 permintaan per menit per admin.

Salinan yang bisa didekripsi tetap meningkatkan dampak jika akun Super Admin atau server diambil alih. Implementasi ini mengikuti permintaan akses password berulang khusus Super Admin, bukan mengubah Supabase Auth menjadi penyimpanan plaintext.

## Konfigurasi dan status penerapan

BELUM diterapkan pada database produksi dan tidak mengubah password akun nyata selama pengujian. Penolakan persetujuan otomatis pada migrasi V11 sebelumnya belum dicabut. Tidak ada percobaan untuk melewati penolakan itu. Publikasi GitHub belum tersedia karena akses tulis sesi sebelumnya ditolak HTTP 403.

Migrasi baru untuk ditinjau: `supabase/migrations/20260924073548_crew_password_vault_profile_roles.sql`. Memerlukan migrasi V11. Migrasi membuat tabel ciphertext privat, RPC server, trigger invalidasi pada auth.users, dan memperbaiki manage_crew. Tidak mereset database atau password crew.

Setelah penerapan database disetujui, backend membutuhkan secret `CREW_PASSWORD_VAULT_KEY`, berisi tepat 32 byte acak dalam encoding base64. Buat secara lokal pada server/secret manager, misalnya:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Simpan hasil hanya pada environment backend. Jangan memakai prefix VITE_, mengunggahnya ke repo, atau menaruhnya pada frontend. Semua instance backend harus memakai kunci yang sama. Simpan cadangannya di secret manager. Mengganti kunci tanpa migrasi enkripsi membuat salinan lama tidak bisa dibaca. Kunci tidak disertakan dalam paket ini.

Tanpa kunci atau migrasi, login dan pembuatan/reset akun tetap berjalan. Salinan untuk ditampilkan tidak tersedia. Jangan mengaktifkan pembaruan produksi sebelum prasyarat database ditinjau dan disetujui.

## Pengujian

- 83 tes backend lulus tanpa skip, termasuk PostgreSQL lokal.
- 38 tes frontend lulus.
- TypeScript dan production build lulus. Peringatan ukuran bundle/jspdf yang sudah ada tetap muncul.
- Browser desktop/390 px: tampilkan password sesuai permintaan, sembunyikan saat blur/menutup dialog, kondisi tanpa salinan, promosi Head Store/Event Manager dari Detail Crew, edit profil tetap mempertahankan role, dan kontrol tidak tersedia bagi Event Manager.
- SQL: migrasi bisa dijalankan ulang, hanya service role dapat memanggil RPC, actor selain Super Admin tidak dapat membaca, password berubah menghapus salinan, versi Auth yang berubah menolak penyimpanan salinan terlambat, audit tidak mengandung credential, dan admin nonaktif ditolak.
- Kriptografi: ciphertext berbeda untuk password sama, ID akun salah/kunci salah/ciphertext diubah ditolak.

Tes memakai fixture lokal. Tidak menguji penggantian atau pembacaan password crew nyata pada produksi.
