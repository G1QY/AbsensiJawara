# V11: akun crew, Head Store, status absensi dan GPS guest

Dasar perubahan: `main` d340a298839903b7fb89baa14c2a27e1ae19ccb7.

## Hasil

- Hapus permanen tersedia untuk Super Admin. Konfirmasi memerlukan email akun.
- Backend menonaktifkan akun sebelum memanggil Supabase Auth Admin `deleteUser(userId, false)`. Penghapusan Auth menghapus `users`, `crew`, role, penugasan, jadwal, absensi, izin, koreksi, lembur dan notifikasi terkait melalui foreign key.
- Referensi PIC, penanda tangan, peninjau dan penulis menjadi NULL. Event, store, checklist bersama dan audit tidak dihapus. Audit penghapusan tercatat dalam transaksi database yang sama.
- Email akun yang berhasil dihapus dapat dipakai kembali. Menu Akun & Hak Akses juga menampilkan akun yang sebelumnya diarsipkan untuk dibersihkan tanpa membuka tabel manual.
- Jika Auth gagal atau hasilnya tidak dapat dipastikan, API tidak melaporkan sukses. Akun tetap nonaktif dan penghapusan dapat dicoba kembali. File Storage dengan kepemilikan langsung oleh akun ditolak sebelum penghapusan dimulai. Unggahan aplikasi menggunakan kepemilikan server.
- Nonaktifkan tetap mempertahankan akun dan riwayat. Hapus permanen memang menghilangkan riwayat crew tersebut. File foto dalam storage tidak otomatis dibersihkan oleh foreign key database.
- Super Admin dapat memilih Crew Store, Crew Event, Head Store, Event Manager atau Super Admin di Akun & Hak Akses. Jenis akun baru tetap mengikuti Crew Store atau Crew Event yang dipilih saat Tambah Crew.
- Role sendiri tidak bisa diubah atau dihapus. Akun berrole Super Admin tidak dapat dihapus lewat Hapus Crew. Perubahan role memerlukan Super Admin aktif dan dicatat dalam audit.
- Head Store menggantikan Admin Store. Kota dipilih dari kota cabang yang sudah ada. Akun Head Store memantau seluruh cabang dan store/kantor dalam satu kota, crew per cabang, serta absensi store dalam rentang tanggal. Halaman crew dan absensi menyediakan ekspor Excel/PDF.
- Endpoint Head Store menentukan kota dari database berdasarkan pengguna terautentikasi. Parameter kota atau actor dari klien tidak digunakan. Endpoint admin global ditolak. RLS membatasi Head Store dan akun nonaktif agar tidak melewati API melalui Data API langsung.
- Perubahan role berlaku pada permintaan API berikutnya. Pengguna masuk kembali untuk memperbarui menu.
- Laporan menampilkan jadwal, toleransi, label masuk, menit telat dan status lembur terpisah. Ekspor memuat kolom terpisah untuk semua nilai tersebut.
- Peta guest mengikuti GPS perangkat. Geser, zoom, klik ganda, keyboard dan sentuhan dinonaktifkan. Foto dan pengiriman tetap memeriksa GPS sesuai alur V10.

## Aturan status

- `PRESENT` ditampilkan sebagai Tepat waktu. Masuk lebih awal diperbolehkan.
- `LATE` ditampilkan sebagai Terlambat. Menit telat dibulatkan ke atas, lalu dibandingkan dengan toleransi jadwal. Default toleransi 0 menit.
- Contoh: jadwal 13:30, masuk 13:31:19 menghasilkan 2 menit telat. Catatan lama tidak diubah menjadi tepat waktu.
- Tanpa jadwal, sistem tidak membuat penilaian tepat waktu/telat otomatis.
- Lembur dihitung per jam penuh sesudah jadwal selesai. Selisih 59 menit 59 detik belum dihitung, 60 menit menghasilkan 60 menit lembur.
- Belum clock-out ditampilkan terpisah. Setelah clock-out: NONE = Tidak lembur, PENDING = Menunggu persetujuan, APPROVED = Lembur disetujui, REJECTED = Lembur ditolak.
- Jam lebih tidak otomatis disetujui. Persetujuan berasal dari flag jadwal atau tinjauan admin. Status masuk dan lembur dapat berbeda, misalnya masuk tepat waktu dengan lembur disetujui.

## Migrasi dan penerapan

File: `supabase/migrations/20260918102008_head_store_accounts_attendance.sql`.

Status saat penyerahan: migrasi telah lulus pengujian PostgreSQL lokal, tetapi BELUM diterapkan pada Supabase JAWARA. Pemeriksaan persetujuan otomatis menolak penerapan langsung karena mengubah RLS, hak eksekusi fungsi, role lama dan relasi penghapusan pada database produksi. Perlu persetujuan khusus pengguna sebelum penerapan produksi. Tidak ada akun produksi dihapus atau role pengguna produksi diubah selama pengujian.

Publikasi GitHub juga belum berhasil: git push tidak memiliki kredensial tulis dan koneksi GitHub mengembalikan HTTP 403 `Resource not accessible by integration`. Branch hanya tersedia lokal; belum ada PR. Paket penyerahan berisi source lengkap dan patch Git agar perubahan dapat ditinjau dan dilanjutkan setelah akses tulis tersedia.

Setelah persetujuan, terapkan migrasi bersama pembaruan backend dan frontend. Tinjau cadangan database sebelum mengaktifkan fungsi Hapus permanen. Jangan jalankan reset database. Migrasi memindahkan membership ADMIN_STORE menjadi HEAD_STORE. Akun lama mendapatkan kota dari cabang crew jika tersedia. Akun yang belum memiliki kota ditolak saat mengakses monitoring sampai Super Admin memilih kota.

Migrasi mempertahankan `ADMIN_STORE` sebagai kode kompatibilitas di tabel roles, tetapi tidak menawarkannya sebagai pilihan role baru. Seed baru menggunakan HEAD_STORE. Fungsi `manage_crew` tidak boleh mengganti role akun yang telah dipromosikan saat profil diedit. Untuk mengembalikannya menjadi crew, gunakan Ubah role.

RLS baru menggunakan helper privat dengan peran terbaru dari database, tidak memakai `user_metadata`. RPC baru hanya dapat dieksekusi oleh service role. Pembaruan juga mengembalikan hak eksekusi fungsi kalender ke server saja, karena grant pada database aktif berbeda dari migrasi lama di repo.

## Verifikasi

- TypeScript dan production build frontend lulus. Peringatan ukuran bundle/jspdf lama tetap ada.
- 80 tes backend, termasuk PostgreSQL lokal, seluruhnya lulus tanpa skip.
- 38 tes frontend lulus.
- Browser desktop/HP: promosi Head Store, pemilihan kota, konfirmasi hapus akun arsip, laporan tepat waktu/telat/lembur, navigasi Head Store, filter, ekspor Excel dan layout 390 px lulus.
- Browser guest: geser mouse, wheel, klik ganda, keyboard dan sentuhan tidak mengubah peta. Foto memakai GPS, perubahan GPS meminta foto baru, kegagalan layanan alamat memiliki fallback, dan pengiriman ulang tetap diuji.
- SQL lokal: role tidak dapat dipromosikan oleh Head Store, akses lintas kota ditolak, RPC ditolak untuk anon/authenticated, akun arsip dapat dihapus, relasi bersama bertahan, dan email yang sama dapat dipakai ulang.
- Penghapusan Auth pada tes HTTP memakai stub. Cascade, audit dan penggunaan kembali email diuji di PostgreSQL lokal. Tidak menguji hapus akun nyata pada produksi.

CI menjalankan tes migrasi dan browser ini pada push/PR. Pengujian memakai fixture terisolasi dan tidak menambah data dummy ke aplikasi produksi.
