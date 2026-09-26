V14: Tampilan role, pusat akun, dan alur payroll
Tanggal: 26 September 2026
Dasar patch: V13, commit 71c65e1dda3f828285282c3b50d293cdd474a370

Perubahan

1. Event Manager memiliki area sendiri. Menu: Dashboard Event, Kelola Event,
   Crew Event, Absensi Event, Rekap Event, Absensi Saya, Riwayat Saya, Payroll Saya.
   Dashboard menampilkan data event, crew event aktif, agenda, dan tinjauan
   kehadiran. Grafik status dapat diklik untuk menampilkan nama event.
   Jumlah crew pada event selesai tetap memuat riwayat penugasan.
   Crew Event merupakan daftar operasional. Penugasan dan PIC di Kelola Event.
   Pembuatan akun, perubahan profil/gaji/role, lokasi store/kantor, laporan
   global, dan audit global tidak tersedia bagi Event Manager.
   Backend membatasi data crew, direktori, dan tinjauan absensi pada cakupan
   event, termasuk menolak akses melalui URL langsung. Event Manager tetap
   dapat membaca fee per event, tetapi tidak memfinalkan atau membayarnya.

2. Head Office memakai Ringkasan Head Office, dengan grafik kehadiran pribadi.
   Staff Kantor memakai Agenda Kantor, dengan jadwal dan status kehadiran.
   Staff Produksi memakai Shift Produksi, dengan shift berjalan/hari ini
   sebagai bagian utama. Tampilan desktop dan ponsel disesuaikan.
   Semua angka berasal dari data pekerjaan masing-masing akun.
   Divisi tetap label profil. Tidak ada penambahan akses lintas karyawan,
   target produksi, laporan keuangan, atau pekerjaan divisi yang belum ada.

3. Role, divisi, kota cakupan, lihat password, dan atur password berada di
   Akun & Hak Akses. Bagian tersebut dihapus dari Detail Crew.
   Pada Akun & Hak Akses, pilih Ubah role atau Password akun pada karyawan.
   Password tetap khusus Super Admin, tersembunyi setelah 30 detik/saat blur,
   dan tidak masuk ekspor. Konfigurasi vault V12 tetap diperlukan.
   Kelola Crew tetap untuk profil, penempatan, jadwal, gaji dasar, dan status.

4. Payroll menampilkan aturan periode dan tiga tahap: Draft, Final, Dibayar.
   Pesan simpan membedakan aturan periode dan penyesuaian satu karyawan.
   Detail slip menunjukkan alasan belum dapat difinalkan dan menyediakan
   tombol membuka aturan periode atau tinjauan absensi bila sesuai.
   Tombol finalisasi/pembayaran berada di atas rincian slip.
   Nominal gaji diisi dalam rupiah penuh. Angka 10 berarti Rp10, bukan Rp10.000.
   Angka 2500000 berarti Rp2.500.000.

Cara payroll

1. Pilih bulan, lalu Atur aturan periode. Simpan aturan payroll untuk bulan itu.
2. Periksa draft. Gaji dasar mengikuti profil karyawan. Gunakan penyesuaian
   hanya bila karyawan memerlukan tarif, tambahan, atau potongan khusus.
   Simpan penyesuaian tidak menyimpan aturan bulan dan tidak memfinalkan slip.
3. Selesaikan tinjauan absensi/izin/lembur. Payroll bulanan menunggu akhir
   periode dan shift terakhir. Payroll event menunggu event selesai.
4. Buka Periksa draft, tekan Finalkan payroll, periksa nominal, lalu Konfirmasi
   finalisasi. Slip menjadi Final. Nominal/rincian disimpan sebagai snapshot.
5. Lakukan transfer atau pembayaran tunai di luar aplikasi. Buka slip Final,
   pilih Catat pembayaran, isi tanggal dan referensi, lalu Simpan pembayaran.
   Slip menjadi Dibayar. Aplikasi tidak mentransfer uang ke rekening.
6. Slip Final yang belum dibayar dapat dibuka kembali dengan alasan.
   Slip Dibayar dikunci. Finalisasi dan pencatatan bayar masih per karyawan.

Pengelola payroll

Dalam aplikasi ini hanya Super Admin mengubah aturan, menyesuaikan,
memfinalkan, dan mencatat pembayaran. Pemilihan divisi Finance belum memberi
izin payroll karena divisi adalah label. Jika pekerjaan ini didelegasikan ke
Finance, akses tersebut perlu diatur tersendiri. Jangan mempromosikan seluruh
staf Finance menjadi Super Admin hanya untuk membuka payroll.

Pemasangan dari V13

Paket berisi V14_dari_V13.patch. Terapkan hanya pada source yang sudah V13.
Tidak perlu mengulang patch V12/V13, menjalankan SQL baru, atau mereset database.
Tidak ada perubahan dependency ataupun environment baru. Pertahankan env
backend/frontend dan kunci vault yang sudah digunakan.

Di PowerShell, buka folder repo. Simpan pekerjaan lokal dahulu melalui Git,
lalu salin file patch ke folder repo. Jalankan:

  git status
  git apply --check .\V14_dari_V13.patch
  git apply .\V14_dari_V13.patch
  cd frontend
  npx tsc --noEmit
  npm run build
  cd ..

Jika pemeriksaan patch gagal, berhenti dan periksa file yang berbeda. Jangan
memakai reset --hard atau menimpa perubahan lokal agar patch dipaksa masuk.
Setelah patch terpasang, restart backend lokal dan frontend lokal, atau commit
perubahan lalu deploy backend Render dan frontend yang dipakai aplikasi.
Keluar dan masuk kembali agar menu sesuai role terbaru.

Verifikasi

98 tes backend termasuk PostgreSQL lokal, akses role, vault password, payroll,
absensi, jadwal, dan pembatasan baru Event Manager lulus tanpa skip.
35 tes frontend lulus. TypeScript dan production build lulus.
9 suite browser lulus: update-browser, head-store-accounts-browser,
crew-password-browser, guest-submission-browser, staff-v13-browser,
role-workspaces-v14-browser, payroll-persisted-browser,
dashboard-finance-browser, location-language-browser.

Pengujian browser memakai akun/data fixture lokal. Payroll diuji melalui
Express dan kalkulator asli dengan penyimpanan RPC fixture. Pengujian SQL
terpisah memakai PostgreSQL lokal. Tidak ada akses/password/gaji akun produksi
yang diubah. Tidak ada deployment atau push GitHub dalam revisi ini.
Peringatan bundle besar dan impor PDF yang sudah ada masih muncul saat build.
