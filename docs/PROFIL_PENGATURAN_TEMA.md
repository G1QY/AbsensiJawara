# Profil, Pengaturan, dan Tema

Revisi ini diterapkan pada FotoSnaps_Absensi.zip unggahan Anda, setelah perbaikan sidebar Guest Crew.

## Yang berubah

- Menu profil dan lonceng kembali untuk guest, admin, dan crew. Menu profil berisi Profil Saya, Pengaturan, dan Keluar.
- Tombol Keluar berada di menu profil dan halaman Pengaturan. Riwayat absen tidak dikembalikan ke portal guest.
- Profil dapat mengubah nama, nomor telepon, dan foto. Foto mendukung JPG/PNG/WebP maksimal 3 MB. Server memvalidasi lalu mengubah foto menjadi JPEG 512 piksel dan membuang metadata gambar.
- Guest dapat mengisi email kontak. Profil, foto, dan pemberitahuan guest hanya berlaku selama sesi di memori. Keluar atau refresh menghapus profil sesi; pengaturan tema tetap tersimpan pada browser.
- Akun terdaftar menggunakan public.users untuk nama/telepon dan bucket S3 privat yang sudah dikonfigurasi untuk foto. Metadata Auth menyimpan kunci foto, bukan URL publik. Endpoint tidak menerima userId tujuan dari klien.
- Penggantian email akun terdaftar meminta password saat ini dan memanggil alur updateUser milik Supabase Auth. Email pada public.users disinkronkan dari alamat yang sudah dikonfirmasi Auth saat login atau memuat profil kembali. Role tidak berasal dari metadata yang dapat diedit pengguna.
- Pengaturan berisi tema, badge notifikasi, pemeriksaan kamera/lokasi, dan akses profil/keluar. Pemeriksaan perangkat hanya berjalan atas klik pengguna dan tidak mengirim hasilnya ke server.
- Notifikasi akun terdaftar membaca endpoint /api/notifications yang sudah ada. Tanda dibaca disimpan hanya untuk notifikasi milik akun sendiri. Guest tidak memanggil endpoint notifikasi akun.
- Tema terang memakai kartu putih dan teks biru gelap. Tema gelap memakai biru malam dan teks putih. Pergantian tema langsung, tanpa interpolasi warna abu-abu atau filter pembalik foto.

## Menerapkan

1. Hentikan backend dan frontend.
2. Ekstrak ZIP terbaru dan salin perubahannya ke proyek aktif. Pertahankan backend/.env dan frontend/.env milik Anda.
3. Jalankan npm start dari backend dan npm run dev dari frontend.
4. Tidak ada dependency aplikasi baru dan tidak ada migrasi SQL baru untuk fitur ini.

Foto akun terdaftar memerlukan konfigurasi S3 yang sama seperti foto absensi: endpoint, region, access key, secret key, serta bucket privat yang sudah ada. Folder objek avatars/{id-akun}/ dibuat melalui unggahan, bukan SQL.

## Konfirmasi email akun

Penggantian email pada Profil Saya memakai email Supabase Auth, terpisah dari pengiriman OTP reset password melalui RESEND_API_KEY pada backend.

- Pastikan pengiriman email Auth/SMTP di Supabase sudah dikonfigurasi untuk alamat pengguna yang dituju.
- Pertahankan Secure Email Change aktif. Pengguna mengikuti permintaan konfirmasi pada email lama dan baru. Jangan mematikan konfirmasi sekadar untuk melewati proses ini.
- Atur Site URL pada Authentication > URL Configuration ke alamat aplikasi yang Anda gunakan, misalnya http://localhost:8443 untuk komputer lokal. Untuk publik, gunakan HTTPS.
- Setelah konfirmasi selesai, masuk ulang memakai email baru. Profil aplikasi akan mengambil alamat terverifikasi dari Auth.
- Jika pengiriman gagal, halaman menampilkan kegagalan, tidak mengklaim email sudah berubah.

Dokumentasi resmi: https://supabase.com/docs/reference/javascript/auth-updateuser

## Verifikasi yang sudah dilakukan

- Build produksi Vite berhasil.
- 10 tes sesi login yang sudah ada berhasil.
- 9 tes layanan profil berhasil: pembatasan kepemilikan, validasi input, perubahan email, keamanan path avatar, validasi gambar, dan pembersihan unggahan gagal.
- Browser Chromium: masuk guest, buka profil/notifikasi, ubah nama/email kontak, simpan foto, ubah tema, preferensi badge, navigasi mobile, keluar, dan isolasi profil/notifikasi antar sesi.
- Browser Chromium dengan API simulasi khusus pengujian: profil akun terdaftar berhasil/gagal menyimpan, konfirmasi email tertunda, penandaan notifikasi, keluar lewat Pengaturan. Simulasi tidak dimasukkan ke aplikasi.
- Pasangan warna judul, teks penjelas, label, input, tombol, breadcrumb, dan pesan status yang diuji pada halaman profil melewati rasio 4,5:1 pada kedua tema. Rasio terendah dari sampel ini adalah 6,24:1.
- Pemeriksaan TypeScript seluruh arsip masih menunjukkan error lama pada AdminDashboard, AdminPayroll, EventWorkflow, dan shared/PayrollPage. Tidak ada error TypeScript pada file fitur baru/diubah ini; modul arsip tersebut bukan bagian alur aktif yang dibuild.

Belum diverifikasi pada project Supabase Anda: penyimpanan profil nyata, pengunggahan S3 nyata, dan pengiriman konfirmasi email nyata. Tes layanan memakai dependensi pengujian; tes browser akun terdaftar memakai respons API simulasi. Pengujian UI tidak menggantikan pengujian integrasi ini.

## Scope data Guest Crew

Revisi ini tidak mengubah mesin absensi guest dari ZIP unggahan: pilihan event masih memakai data dummy dan catatan absensi masih menggunakan penyimpanan browser. Nama/foto profil akun dan tema tidak membuat data absensi guest otomatis tersambung ke server. Integrasi data guest tetap pekerjaan terpisah.
