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
