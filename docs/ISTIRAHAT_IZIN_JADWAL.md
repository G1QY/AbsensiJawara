# Istirahat shift, izin/sakit, dan kalender kerja

Pembaruan source lokal 24 Oktober 2026. Dokumen ini tidak menyatakan migrasi atau deployment production sudah dilakukan.

## Mengatur waktu istirahat

Super Admin membuka **Kelola Crew → Detail → Atur Jadwal Kerja → Buat jadwal**. Pilih Shift 1, 2, atau 3, lalu aktifkan **Istirahat pada shift ini** dan isi jam mulai/selesai. Pengaturan yang sama tersedia ketika mengedit satu jadwal dan membuat jadwal beberapa crew. Pada workspace event, pengaturan istirahat tersedia per jadwal crew.

- Satu rentang istirahat dapat diatur untuk setiap shift, misalnya kerja 07:00–12:00 dan istirahat 09:00–10:00.
- Istirahat harus seluruhnya berada di dalam shift. Shift malam melewati tengah malam didukung, misalnya kerja 22:00–06:00 dan istirahat 02:00–03:00.
- Istirahat bersifat opsional pada pengaturan jadwal. Jadwal lama tetap tanpa istirahat sampai admin mengaturnya.
- Jam shift/istirahat yang sudah dipakai untuk absensi tidak dapat diubah agar bukti tetap konsisten.

## Crew mencatat istirahat

Setelah Clock In, halaman **Absensi** menampilkan kartu **Istirahat shift**. Tombol mulai tersedia sejak jam mulai istirahat sampai sebelum shift berakhir. Crew mengambil foto kamera untuk **Mulai istirahat**, lalu mengambil foto baru untuk **Selesai istirahat**. Clock Out dinonaktifkan selama istirahat masih berjalan.

Foto memuat jenis aktivitas, waktu, lokasi GPS aktual jika alamat tersedia, koordinat, akurasi, dan penugasan. Koordinat tetap dicetak ketika pencarian alamat belum berhasil. Backend menyimpan waktu server, koordinat, dan foto private; lokasi mengikuti mode crew **Sesuai penugasan** atau **Semua lokasi**. GPS dan foto tetap wajib dalam kedua mode.

Jam aktual dapat berbeda dari jam rencana dan ditampilkan sebagai bukti untuk ditinjau admin. Selesai istirahat tetap dapat dicatat setelah jam rencana berlalu agar crew dapat menutup absensi. Jika istirahat tidak pernah dimulai, Clock Out masih tersedia; kolom bukti istirahat tetap belum tercatat. Sistem tidak mengarang waktu istirahat atau menambahkan potongan gaji otomatis. Aturan payroll yang berlaku tetap digunakan.

Super Admin dapat melihat foto dan waktu mulai/selesai melalui **Absensi → Lihat Detail/Tinjau Absensi**. Ekspor absensi menyertakan waktu mulai, selesai, dan durasi aktual istirahat. Bukti baru mengembalikan status tinjauan absensi menjadi menunggu tinjauan.

## Izin, sakit, dan libur crew

1. Crew membuka **Absensi → Izin & sakit → Ajukan izin / sakit**, memilih jenis, tanggal, dan alasan. Maksimal 31 hari dalam satu pengajuan.
2. Pengajuan berstatus **Menunggu persetujuan**. Status ini belum membebaskan kewajiban hadir.
3. Super Admin membuka **Absensi → Pengajuan izin & sakit**, lalu menyetujui atau menolak. Penolakan memerlukan catatan.
4. Setelah disetujui, kalender dan kewajiban hadir mengikuti status izin/sakit. Crew dapat memuat ulang daftar untuk melihat keputusan.

WhatsApp dapat digunakan untuk komunikasi tambahan. Jika konfirmasi diterima di luar aplikasi, Super Admin dapat langsung menetapkan **Sakit**, **Izin**, atau **Libur crew** lewat **Atur Jadwal Kerja → Libur & izin**. Libur crew ditetapkan admin; tidak menjadi pilihan pengajuan mandiri.

Tanggal yang sudah memiliki absensi, pengajuan lain yang aktif, atau payroll final dilindungi dari perubahan yang bertentangan. Pengajuan pending yang akhirnya diikuti kehadiran dapat ditolak. Untuk membatalkan status harian yang ditetapkan admin, gunakan **Aktifkan kerja**; tindakan ini tidak membuat jadwal baru.

## Libur nasional dan cuti bersama

Libur nasional merupakan informasi kalender. Jika ada jadwal kerja yang aktif pada tanggal tersebut, crew tetap **Terjadwal** dan dapat Clock In sesuai jadwal. Status izin/sakit/libur pribadi yang disetujui tetap berlaku.

Jika tanggal libur belum mempunyai jadwal, kalender menampilkan **Tanpa jadwal**, disertai informasi hari nasional. Admin perlu membuat jadwal pada tanggal itu. Jadwal rentang memasukkan hari nasional apabila hari dalam minggu tersebut dipilih; sistem tidak menyalin jam dari tanggal lain secara otomatis. Untuk kekosongan jadwal lama, buat jadwal khusus tanggal yang kosong. Membuat ulang rentang yang lebih luas juga memperbarui jadwal existing yang belum dipakai absensi, sehingga jam kerja dan istirahat dalam rentang tersebut harus diperiksa dahulu.

## Penerapan dan verifikasi

Terapkan `supabase/migrations/20261023150118_shift_breaks_permissions.sql` setelah prasyarat migrasi repo tersedia, termasuk payroll/jadwal, kalender payroll tahunan, dan mode lokasi crew. Migrasi menambahkan kolom istirahat serta RPC pengajuan/tinjauan izin, tanpa mengubah catatan absensi lama. Cocokkan riwayat migrasi dengan skema tujuan sebelum menerapkan. Setelah database siap, deploy backend dan frontend dari perubahan yang sama.

Pengujian lokal mencakup transisi istirahat, GPS/foto wajib, kepemilikan absensi, pengiriman ganda, shift malam, izin yang bertumpuk, pembatasan akses, dan libur nasional. Tes browser memakai data simulasi, kamera/GPS simulasi, tampilan desktop dan mobile. Pengujian perangkat fisik dan smoke test production tetap dilakukan setelah rilis.

Tampilan login dipertahankan seperti versi sebelumnya sesuai keputusan pengguna.
