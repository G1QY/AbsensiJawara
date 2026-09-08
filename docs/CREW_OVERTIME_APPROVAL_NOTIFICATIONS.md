# Potongan, lembur, persetujuan, dan notifikasi crew

## Aturan yang diterapkan

- Keterlambatan dihitung dari waktu server terhadap jadwal dan dibulatkan ke atas per jam untuk estimasi potongan.
- Clock-out setelah jadwal tidak otomatis menjadi lembur berbayar.
- Hanya jam penuh setelah jadwal selesai yang dicatat sebagai kandidat lembur.
- Jika admin mencentang **Setujui lembur dari jadwal**, kandidat lembur otomatis berstatus `APPROVED` saat clock-out.
- Jika pilihan tersebut tidak dicentang, kandidat lembur berstatus `PENDING` dan bonus tetap Rp0 sampai admin menyetujui.
- Penolakan admin mengubah status menjadi `REJECTED` dan tidak menghasilkan bonus.
- Keputusan absensi dan lembur dikirim ke tabel `notifications` milik akun crew secara atomik bersama audit log.

## Lokasi di aplikasi

- Admin Store: **Kelola Crew → Detail crew Store → Atur Jadwal**.
- Admin Event: **Kelola Event → Tambah/Edit Event**.
- Admin review: tabel **Absensi** memisahkan Persetujuan Absensi, Persetujuan Lembur, dan Aksi. Tombol langsung menunjukkan Tinjau Absensi atau Tinjau Lembur.
- Crew: **Riwayat** menampilkan status persetujuan absensi dan lembur secara terpisah, jam telat, potongan, jam lembur, dan bonus.
- Crew: ikon lonceng di topbar menampilkan hasil persetujuan akun yang sedang login.

## Migrasi wajib

Jalankan `supabase/migrations/20260901021500_crew_overtime_approval_notifications.sql` sebelum memakai UI versi ini. Migrasi menambah `overtime_preapproved`, indeks notifikasi, sinkronisasi kebijakan event ke jadwal crew, serta notifikasi keputusan yang atomik.

Tarif yang tampil pada halaman crew saat ini adalah estimasi Rp10.000 per jam, sama dengan nilai awal simulasi payroll admin. Pembayaran final tetap perlu modul payroll final bila kebijakan perusahaan berubah.
