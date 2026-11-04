# Dokumentasi JAWARA

Panduan terbaru: [Istirahat shift, izin/sakit, dan kalender kerja](ISTIRAHAT_IZIN_JADWAL.md) — perubahan lokal 24 Oktober 2026. Lihat juga [GPS dan watermark foto absensi](ABSENSI_GPS_WATERMARK.md) dan [Payroll, jadwal, libur dan izin](PAYROLL_JADWAL.md).

Panduan umum diperbarui 5 Oktober 2026 berdasarkan source baseline `805c40b`; panduan payroll/jadwal diperbarui 6 Oktober 2026 mengikuti perubahan lokal terbaru.

## Panduan aktif

| Dokumen | Kegunaan |
| --- | --- |
| [README proyek](../README.md) | Fitur, struktur dan perintah utama. |
| [PRD dan relasi data](PRD_ERD_CURRENT.md) | Cakupan, role, aturan bisnis dan model data. |
| [Setup](SETUP.md) | Environment lokal, integrasi dan deployment. |
| [Akun dan role](ADMIN_CREW_ACCOUNTS.md) | Bootstrap, hak akses dan pemulihan password. |
| [GPS dan watermark foto](ABSENSI_GPS_WATERMARK.md) | Lokasi aktual pada foto, tampilan mobile, dan layanan alamat. |
| [Istirahat dan izin/sakit](ISTIRAHAT_IZIN_JADWAL.md) | Foto awal/akhir istirahat, pengajuan crew, persetujuan admin, dan kalender hari nasional. |
| [Aliran data](MIGRATING_FROM_DUMMY_TO_REAL_DATA.md) | Pengganti panduan migrasi dummy lama. |
| [Desain](DESIGN.md) | Tema, komponen dan perilaku UI aktual. |
| [Checklist rilis](RELEASE_CHECKLIST.md) | Verifikasi dan penerapan perubahan. |
| [Backend](../backend/README.md) | Middleware, route dan akses. |
| [Database](../supabase/README.md) | Sumber SQL dan batas migrasi. |
| [Setup Supabase](SUPABASE_SETUP.md) | Database/Auth/Storage. |

Panduan aktif menjelaskan implementasi yang ditemukan pada source. Jika berbeda, cocokkan kode, SQL dan tes pada commit yang digunakan. Perubahan production harus diperiksa terhadap skema yang benar-benar terpasang.

## Riwayat dan referensi pendukung

- `UPDATE_*.md`, `REPORT_PROGRESS_*.md` dan `REMOVE_UNUSED_DEMO.md` merupakan catatan historis. Instruksi patch, tanggal tes dan status deployment di dalamnya tidak otomatis berlaku pada checkout sekarang.
- [RELEASE_2_HARI.md](RELEASE_2_HARI.md) mengarahkan ke checklist rilis aktif; scope rilis awal sudah digantikan.
- Dokumen fitur lain tetap disimpan sebagai referensi implementasi, dengan penanda bahwa isinya belum diselaraskan penuh. Gunakan panduan aktif untuk setup, role dan arsitektur umum.
- [Laporan analisis 5 Oktober](PROJECT_HANDOVER_20261005.md) adalah snapshot sebelum pembaruan dokumentasi ini. Temuan dokumentasi usang di sana merekam keadaan sebelum perbaikan; hasil tes/cloud tetap memiliki tanggal pemeriksaannya sendiri.

## PRD lama

[PRD/ERD v2.0](PRD_ERD_MASTER_BujanganFood_FotoSnaps_v2_0.pdf) adalah arsip desain multi-tenant Bujangan Food dan FotoSnaps. Penggantinya adalah [PRD_ERD_CURRENT.md](PRD_ERD_CURRENT.md).

Berkas lama berakhiran `.pdf`, tetapi format aktualnya adalah ZIP berisi tujuh gambar halaman, tujuh teks halaman dan `manifest.json`. Berkas asli dipertahankan; bukan PDF standar atau panduan skema siap dijalankan. Isinya ditinjau melalui teks halaman di dalam arsip.

## Merawat dokumentasi

Perubahan route/role diperbarui di panduan akun/backend; perubahan SQL di panduan database/PRD; environment di SETUP; UI di DESIGN. Catatan rilis menyimpan perbedaan versi dan bukti tes beserta tanggal serta batas verifikasinya.
