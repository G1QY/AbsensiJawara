# Perpindahan tugas dan absensi

## Terapkan
1. Jalankan supabase/migrations/20260907140529_assignment_attendance_transfer.sql pada Supabase SQL Editor. Migrasi ini diperlukan untuk pemindahan jadwal secara atomik bersama perubahan penugasan.
2. Restart backend dan build ulang frontend.

## Perilaku
- Saat crew store dipindahkan melalui Kelola Crew, jadwal tersisa dari penugasan lama yang belum memiliki absensi mengikuti toko baru mulai tanggal berlaku. Jam kerja, toleransi dan persetujuan lembur pada jadwal dipertahankan. GPS mengikuti toko baru dari ID penugasan baru.
- Absensi masa lalu dan jadwal yang sudah dipakai tetap menunjuk toko asal. Jika perpindahan terjadi saat crew masih clock in, halaman Absensi menampilkan sesi lama untuk menyelesaikan clock out di lokasi asal.
- Jadwal baru tidak dibuat pada hari yang sebelumnya tidak dijadwalkan. Jika kontrak/rentang jadwal lama sudah berakhir, admin perlu menambahkan rentang jadwal baru.
- Migrasi juga memperbaiki jadwal hari ini dan masa depan yang tertinggal pada penugasan lama untuk crew yang sudah dipindahkan. Riwayat sebelum hari penerapan tidak dipindahkan.
- Penugasan event membuat jadwal sesuai tanggal, waktu, dan lokasi event tujuan. Aktivasi ulang penugasan memperbaiki jadwal yang belum dipakai. Penugasan ke event tanpa jam/lokasi lengkap ditolak dengan pesan yang jelas.
- Dua event aktif pada hari yang sama tetap ditolak agar lokasi absensi tidak ambigu. Admin perlu mengakhiri penugasan yang digantikan.
- Pencarian absensi hari ini hanya memilih penugasan yang berlaku. Log dicocokkan dengan ID jadwal, bukan tanggal saja. Kalender mempertahankan riwayat dan tidak menampilkan jadwal lama yang sudah tidak berlaku pada tanggal mendatang.
- Dashboard Crew Store diperbarui setiap 15 detik atau saat halaman kembali aktif. Pembacaan jadwal dibatasi ke bulan berjalan sehingga jadwal kontrak bertahun-tahun tidak menyembunyikan jadwal hari ini.

## Pengujian
41 tes backend lolos tanpa skip dengan PGLITE_MODULE menunjuk instalasi @electric-sql/pglite. Termasuk empat tes SQL lokal dan pengujian endpoint untuk penugasan baru, lokasi asal sesi terbuka, serta pencocokan ID jadwal. Tes memakai PostgreSQL lokal tertanam, bukan database Supabase produksi. CLI Supabase tidak tersedia di lingkungan ini; nama migrasi dibuat menggunakan timestamp UTC saat pengerjaan.
