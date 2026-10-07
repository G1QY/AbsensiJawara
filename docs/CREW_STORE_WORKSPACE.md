> **Status dokumentasi: Referensi implementasi.** Isi berikut merekam versi/fitur tertentu dan belum diselaraskan penuh dengan baseline 5 Oktober 2026. Untuk setup, arsitektur, role dan rilis saat ini, gunakan [indeks dokumentasi aktif](README.md). Instruksi patch/SQL dan hasil tes di bawah berlaku pada konteks versi asalnya, bukan otomatis pada checkout sekarang.

# Crew Store Workspace

Sidebar Crew Store memakai empat menu:

1. Dashboard
2. Absensi
3. Riwayat
4. Payroll

Dashboard membaca profil crew, store aktif, jadwal, dan absensi milik akun yang sedang login melalui `GET /api/crew-store/workspace`.

Payroll menghitung estimasi berikut:

- Gaji pokok dari profil crew.
- Potongan telat dengan pembulatan jam ke atas.
- Bonus lembur dari jam penuh yang berstatus `APPROVED`.
- Absensi yang ditolak admin tidak masuk perhitungan.

Endpoint hanya menerima role `CREW_STORE`. Backend menentukan `crew_id` dari `req.user.id`, sehingga frontend tidak dapat meminta data crew lain.
