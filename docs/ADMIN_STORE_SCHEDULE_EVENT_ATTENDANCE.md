# Admin, Jadwal Store, Event, dan Detail Absensi

## Yang berubah

- Jadwal Crew Store diatur dari **Admin → Kelola Crew → Detail → Atur Jadwal Store**.
- Jadwal Store memakai tabel `store_assignments` dan `store_schedules` yang sudah ada, sehingga tidak memerlukan migrasi database baru.
- Crew Store dan Crew Event hanya memuat jadwal sesuai jenis akunnya. Penugasan lama dari jenis lain tidak dipakai.
- Clock-in pukul 09.45 atau 09.50 untuk jadwal 10.00 diperbolehkan dan dihitung tepat waktu. Clock-in tetap wajib pada tanggal jadwal, memakai GPS, geofence, foto live, dan timestamp server.
- Pesan gagal clock-in sekarang menjelaskan sumber masalah GPS, penugasan, jadwal, geofence, Storage, atau database.
- Absensi Admin memiliki filter sumber akun termasuk Guest serta pilihan pengurutan.
- Detail Absensi menampilkan tepat waktu/telat, lembur, tarif bonus, dan potongan simulasi.
- Detail Event tidak lagi menampilkan Kertas, Keuangan, dan Dokumentasi. Event menyediakan Export Excel/PDF, posisi crew/PIC, serta rincian Payroll event.

## Format kode karyawan

- Form kembali memakai satu kolom Kode Karyawan. Admin memilih cabang dan Store atau Event acuan. Sistem menyarankan nomor berikutnya dan kode tetap dapat diedit sebelum disimpan.
- Crew Store memakai `{KODE_CABANG}-{KODE_STORE}-{NOMOR}`, misalnya `BDG-GACOAN-1`.
- Crew Event memakai `{KODE_EVENT}-{NOMOR}`. Event SMA 1 Bandung berkode `BDG-SMA1` menghasilkan `BDG-SMA1-1`, `BDG-SMA1-2`, dan seterusnya.
- Nomor yang sama boleh dipakai pada prefix berbeda. `BDG-GACOAN-1` dan `BDG-SMA1-1` adalah dua kode berbeda.
- Kode lengkap tetap unik pada seluruh crew. Database menolak kode lengkap yang sama.
- Angka tidak diberi nol di depan. Nomor `1` menghasilkan akhiran `-1`, bukan `-001`.
- Kode crew lama tidak diubah otomatis agar audit, absensi, dan payroll tetap konsisten.
- Pembuatan Crew Event memilih Event sebagai acuan kode, bukan sebagai penugasan operasional. Posisi dan penugasan absensi tetap diatur melalui **Kelola Event → Detail → Crew**.

## Aturan payroll pada tampilan

Default simulasi adalah potongan telat Rp10.000 per jam dan bonus lembur disetujui Rp10.000 per jam. Tarif dapat diubah di halaman Payroll selama sesi aplikasi. Perhitungan ini adalah estimasi, bukan bukti pembayaran final.

## Catatan operasional

- Sumber libur memakai kalender publik Hari Libur Indonesia dari Google Calendar API. Isi `GOOGLE_CALENDAR_API_KEY` pada `backend/.env`, aktifkan Google Calendar API, lalu restart backend. OAuth tidak diperlukan.
- Jadwal Store yang sudah dipakai absensi tidak dapat diubah dari UI.
- Satu Crew Store tidak boleh memiliki dua penugasan Store aktif pada tanggal yang sama.
- Jadwal Store ditolak jika crew memiliki jadwal Event aktif pada tanggal yang sama.
- Minggu bukan libur otomatis. Admin dapat memilih Minggu sebagai hari kerja Store, dan jadwal Event pada Minggu tetap dapat dipakai untuk clock-in/out.
- Libur otomatis hanya mengikuti tanggal libur nasional atau cuti bersama dari kalender yang disinkronkan. Jadwal Event yang memang dibuat pada tanggal tersebut tetap menjadi jadwal kerja dan mengungguli penanda libur.
- Pengujian lokal tidak menggantikan pengujian GPS, Storage S3, dan data Supabase produksi. Setelah memasang paket, uji satu Crew Store di lokasi Store sebenarnya.
