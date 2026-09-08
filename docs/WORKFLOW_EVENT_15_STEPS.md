# Pembaruan workflow event

Jalankan `supabase/migrations/20260903061829_event_workflow_15_steps.sql` satu kali melalui Supabase SQL Editor sebelum memakai backend dan frontend baru. Migrasi ini tidak menghapus akun atau data JSON workflow. Progress lama yang belum selesai kembali ke langkah 1. Workflow lama yang selesai dipetakan ke langkah 15.

Urutan: Clock In, Inventory Before, Transportasi Pergi, Setup Ready, Cek Print Sebelum, Event Berlangsung, Foto Event Selesai, Cek Print Sesudah, Kuota/GB, Transportasi Pulang, Omset, Inventory After, Comparison, Clock Out, Selesai.

Bagian kertas dan jumlah cek print dihapus dari antarmuka. Foto menggunakan kamera langsung dengan preview. Gunakan HTTPS atau localhost agar browser dapat mengakses kamera dan GPS.

Clock In/Out memakai catatan absensi yang sama dengan halaman Absensi. Foto Setup Ready dan Event Selesai disimpan per penugasan crew dengan waktu server dan pemeriksaan radius lokasi event. Data operasional dan inventori tetap dibagikan kepada anggota event.

PDF memuat jadwal, transportasi, keuangan, perbandingan inventori, foto bukti, serta foto absensi crew yang mengekspor. Foto harus dapat diakses dari penyimpanan agar ekspor berhasil.

Validasi: build frontend, TypeScript, 23 tes frontend dan 17 tes backend lulus. Tiga tes integrasi database dilewati karena tidak ada database uji aktif. Generator PDF diuji dengan gambar contoh. Kamera fisik, GPS perangkat, dan koneksi penyimpanan produksi perlu diuji pada perangkat pengguna.
