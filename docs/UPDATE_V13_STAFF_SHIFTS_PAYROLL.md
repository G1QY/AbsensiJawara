# JAWARA V13. Paket gabungan V12, role, shift, dan payroll

Paket disiapkan 26 September 2026. Dasar repo: `origin/main` commit `d39b57b`, yang sudah memuat V11. Source lengkap memasukkan V12 dan seluruh perubahan V13. Tidak perlu memasang source V12 secara terpisah.

## Status penyerahan

Kode, migrasi, dan pengujian tersedia dalam paket. Belum ada penerapan ke Supabase produksi dari sesi ini. Tidak ada akun nyata, password nyata, absensi nyata, atau pembayaran nyata yang diubah selama pengujian.

Push GitHub belum tersedia karena akses tulis integrasi sebelumnya ditolak HTTP 403. Branch lokal disertai patch gabungan agar bisa diterapkan di repo kamu. Persetujuan otomatis sebelumnya menolak migrasi produksi V11 karena perubahan RLS, hak fungsi, role lama, dan relasi penghapusan. Penolakan itu tidak dilewati. Panduan ini menyediakan perubahan konkret untuk ditinjau dan dipasang oleh pemilik proyek setelah prasyaratnya terpenuhi.

## Fitur yang berubah

- Kelola Event tetap menghitung crew historis pada event selesai, termasuk penugasan berstatus ENDED.
- Detail absensi memisahkan ketepatan waktu, status review, dan lembur. Foto Clock In dan Clock Out bisa diklik. Pada HP, daftar absensi memakai kartu.
- Absensi crew terdaftar masuk PENDING. Clock-out atau perubahan bukti mengembalikan status ke PENDING untuk ditinjau lagi. Admin tidak dapat menyetujui absensinya sendiri. Persetujuan absensi dan lembur tetap terpisah.
- Dashboard mengambil data server. Bar chart bisa diklik untuk melihat rincian. Komponen payroll dashboard, menu Payroll, dan slip pribadi memakai perhitungan backend yang sama.
- Akun Head Store, Event Manager, Head Office, Staff Kantor, dan Staff Produksi dapat absen melalui jadwal kerja pribadi. Super Admin tidak memiliki absensi pribadi.
- Ubah role tetap tersedia dari Kelola Crew → Detail dan Akun & Hak Akses. Akun yang dipromosikan tetap dapat dikelola oleh Super Admin tanpa kehilangan role saat profil diedit.
- Fitur V12 untuk salinan password tetap khusus Super Admin. Akun lama tanpa salinan tidak dapat dibaca dari hash. Lihat `docs/UPDATE_V12_CREW_PASSWORD_ROLE.md`.

## Role dan divisi

| Role | Divisi | Akses utama |
|---|---|---|
| Super Admin | Tidak wajib | Pengaturan akun, jadwal, review, seluruh payroll |
| Head Store | Tidak wajib | Monitoring satu kota, absensi dan payroll pribadi |
| Event Manager | Tidak wajib | Kelola event, payroll event baca saja, absensi dan payroll pribadi |
| Head Office | Operational, Finance, Business Development, Marketing, Produksi, Teknisi | Dashboard pekerjaan, absensi dan payroll pribadi |
| Staff Kantor | Operational, Finance, Business Development, Marketing, Produksi, Teknisi | Dashboard pekerjaan, absensi dan payroll pribadi |
| Staff Produksi | Packing, Produksi | Dashboard pekerjaan, absensi dan payroll pribadi |
| Crew Store | Tidak wajib | Absensi store/kantor dan payroll pribadi |
| Crew Event | Tidak wajib | Workflow event, absensi event dan payroll pribadi |

Divisi menjadi title identitas. Divisi Finance tidak memberikan hak mengubah payroll. Semua pengaturan payroll tetap milik Super Admin. Akses backend dan database mengikuti pembatasan ini.

Jika akun manajer belum mempunyai profil kerja, migrasi membuat profilnya. Tetapkan cabang, lokasi kerja, gaji, dan jadwal melalui Kelola Crew. Head Store tetap wajib mempunyai kota cakupan. Setelah role berubah, pengguna masuk ulang agar menu diperbarui.

## Shift 1, Shift 2, dan Shift 3

1. Buka Kelola Crew → Detail → Atur Jadwal Kerja.
2. Pilih shift, tanggal atau rentang tanggal, jam masuk, dan jam pulang.
3. Untuk jadwal massal, pilih lokasi dan seluruh personel atau personel tertentu.
4. Jadwal yang sudah ada dapat diubah per tanggal melalui tombol Ubah jadwal.

Nomor shift adalah label jadwal. Jam tetap ditentukan Super Admin. Memilih Shift 3 tidak otomatis mengasumsikan jam perusahaan. Satu personel memilih satu shift pada satu tanggal penugasan. Kelompok berbeda dapat menggunakan Shift 1, 2, dan 3 pada hari yang sama.

Jam pulang yang lebih awal dari jam masuk berarti pulang pada hari berikutnya. Contoh Shift 3 tanggal 30 September, 22.00–06.00, tetap tercatat sebagai jadwal 30 September dan pulang 1 Oktober. Absensi yang masih berjalan tetap tersedia setelah tengah malam. Jam masuk dan pulang yang sama ditolak. Jadwal bertumpuk ditolak oleh API dan database; batas akhir dan awal yang bersambungan diperbolehkan.

Jadwal lama mendapat label Shift 1 tanpa mengubah jamnya. Jadwal massal melewati jadwal yang sudah ada, libur kalender, dan benturan. Hasil menampilkan jumlah dibuat dan dilewati. Form dan kartu jadwal dapat dipakai pada HP.

## Payroll tersimpan

### Alur Super Admin

1. Buka Payroll dan pilih periode bulan.
2. Buka Atur payroll. Simpan dasar gaji, tarif telat, tarif lembur, dan aturan potongan absen.
3. Tab Store & Kantor menyediakan jenis penempatan Store/Kantor, lokasi spesifik, status, dan pencarian personel.
4. Tab Crew Event menampilkan setiap crew per event, termasuk event selesai dengan penugasan ENDED.
5. Buka Detail. Gunakan Atur komponen gaji untuk tarif periode ini, tunjangan/tambahan, potongan manual, dan catatan wajib.
6. Finalkan payroll setelah periode atau event selesai dan review terkait tuntas. Rincian gaji, aturan, dan data perhitungan tersimpan menjadi slip final.
7. Setelah melakukan pembayaran, gunakan Catat pembayaran dengan tanggal dan referensi transaksi. Aplikasi mencatat pembayaran; tidak melakukan transfer bank.

Aturan disimpan per bulan. Periode baru harus dikonfigurasi. Sebelum aturan disimpan, tarif otomatis bernilai nol dan payroll tidak dapat difinalkan. Gaji mengikuti profil karyawan, kecuali Super Admin memberi tarif khusus pada slip periode tersebut. Gaji bulanan tidak diprorata otomatis untuk tanggal masuk kerja; tarif periode dapat disesuaikan secara manual.

Payroll Draft dihitung ulang dari aturan tersimpan dan absensi terkini. Potongan otomatis mengurangi gaji bersih, bukan mengubah gaji pokok di profil. Setiap perubahan memakai pemeriksaan versi data agar dua admin tidak saling menimpa perubahan tanpa memuat ulang.

### Perhitungan Store dan Kantor

- Dasar gaji: per bulan atau per hari hadir yang lengkap dan disetujui.
- Telat: tarif per jam, dihitung proporsional per menit atau dibulatkan ke atas per catatan kehadiran.
- Lembur: jam penuh yang sudah disetujui, dikali tarif tersimpan.
- Absen: tidak dipotong, gaji bulanan dibagi hari terjadwal, atau nominal tetap per hari.
- Izin disetujui membebaskan potongan absen. Absensi dan izin PENDING tidak langsung dianggap absen dan menghalangi finalisasi.
- Jadwal yang belum selesai, termasuk shift malam, tidak dianggap absen. Jadwal dari lokasi lama dibatasi sesuai perpindahan penempatan. Jadwal ENDED lama tanpa batas akhir yang dapat ditentukan hanya dihitung jika memiliki catatan absensi.
- Gaji per hari hadir tidak dikenai potongan absen kedua kali.
- Gaji bersih = gaji + tambahan lembur + tunjangan − potongan telat − potongan absen − potongan manual. Nilai minimum nol. Sisa potongan tidak dibawa otomatis ke bulan berikutnya.

Contoh teruji: gaji Rp3.000.000, dua hari terjadwal, satu hari absen, telat 15 menit pada tarif Rp12.000/jam, dan dua jam lembur disetujui pada tarif Rp10.000/jam menghasilkan Rp1.517.000. Tunjangan Rp50.000 dan potongan manual Rp10.000 menghasilkan Rp1.557.000.

### Perhitungan Crew Event

Fee memakai tarif per hari hadir disetujui atau satu kali per event selesai dengan kehadiran sah. Periode event mengikuti bulan tanggal event, atau bulan tanggal akhir jika tersedia. Absensi lintas tanggal dalam event yang sama dihitung dalam periode event tersebut.

Telat dan lembur tidak otomatis memotong atau menambah fee event. Super Admin menentukan tarif khusus, transport/tambahan, dan potongan manual beserta alasannya. Detail Kelola Event membaca hasil yang sama dari server. Event Manager dapat membaca rincian event, tetapi tidak mengatur tarif atau menandai pembayaran.

### Slip dan riwayat

Crew dan staf melihat slip sendiri melalui Payroll/Payroll Saya, termasuk periode sebelumnya. API memakai ID pengguna dari sesi, bukan ID yang dikirim klien. Semua tampilan dan ekspor mengambil angka server.

Slip Final tidak berubah ketika gaji profil, aturan, atau absensi kemudian berubah. Super Admin dapat membuka kembali slip Final dengan alasan untuk memperbaikinya sebelum dibayar. Slip Dibayar tidak dapat diubah atau dibuka kembali melalui aplikasi. Tindakan dicatat di audit; finalisasi, pembayaran, dan pembukaan kembali memberi notifikasi.

Slip final tetap menjadi arsip payroll jika akun crew dihapus. Referensi akun berubah menjadi kosong, sedangkan snapshot tetap tersedia untuk Super Admin. Akun Auth dan profil crew tetap terhapus sehingga emailnya bisa dipakai lagi.

## Pemasangan

Paket berisi `source/` lengkap, patch sejak `origin/main`, patch khusus jika source V12 sudah terpasang, migrasi pilihan, panduan, dan bukti pengujian. Jangan menerapkan dua patch sekaligus.

Urutan migrasi yang belum terpasang:

1. Prasyarat V11: `20260918102008_head_store_accounts_attendance.sql`.
2. V12: `20260924073548_crew_password_vault_profile_roles.sql`.
3. V13 role/review: `20260925033622_staff_roles_attendance_review_dashboard.sql`.
4. V13 shift: `20260925113935_work_shift_schedules.sql`.
5. V13 payroll: `20260925222422_persisted_payroll.sql`.

Jalankan hanya migrasi yang belum dipasang. Instalasi harus sudah memiliki schema V11 beserta migrasi notifikasi/persetujuan lembur sebelumnya. Jangan menjalankan reset database atau seluruh file SQL lama sekaligus karena repo juga memuat salinan migrasi historis tanpa timestamp.

Migrasi role/review mengubah absensi lama terdaftar yang masih NOT_REQUIRED dan memiliki Clock In menjadi PENDING. Absensi APPROVED/REJECTED tidak diubah. Akun manajer yang sebelumnya bertipe penugasan Crew Event diselaraskan ke jadwal kerja Store/Kantor, dengan penugasan event lama tetap tersimpan sebagai ENDED.

Migrasi payroll menambah tabel aturan, penyesuaian, slip, dan fungsi server. RLS aktif, akses langsung anon/authenticated ditolak, dan fungsi hanya dapat dipanggil service role. Tidak membuat pembayaran atau menetapkan tarif potongan untuk akun nyata.

Setelah migrasi:

```sh
cd backend
npm ci
npm start
```

Jalankan backend menggunakan environment server yang sudah ada. Untuk salinan password V12, tambahkan `CREW_PASSWORD_VAULT_KEY` sesuai panduan V12. Tidak ada secret disertakan dalam paket.

```sh
cd frontend
npm ci
npm run build
```

Gunakan konfigurasi `VITE_API_BASE_URL` milik instalasi kamu. Restart backend dan terbitkan ulang frontend bersama migrasinya. Pengguna masuk ulang setelah role berubah.

## Verifikasi

- 97 tes backend lulus, termasuk tes API, hak akses, perhitungan payroll, shift malam, relasi penghapusan, dan migrasi PostgreSQL lokal.
- 35 tes frontend lulus. Perhitungan simulasi di frontend telah dihapus; perhitungan payroll diuji di backend.
- TypeScript dan build produksi lulus. Peringatan ukuran bundle/jspdf yang sudah ada tidak menghalangi build.
- Browser: pengaturan shift mobile, divisi dan role baru, review crew, foto, hitungan crew event historis, rincian chart, fitur password V12, filter payroll, penyesuaian gaji, Final/Dibayar, dan slip pribadi.
- Payroll browser memakai Express dan kalkulator sebenarnya dengan fixture RPC. Penyimpanan dan izin SQL diuji terpisah di PostgreSQL lokal. Tidak memakai data produksi.
- Pemeriksaan source tidak menemukan credential yang ikut masuk paket.
