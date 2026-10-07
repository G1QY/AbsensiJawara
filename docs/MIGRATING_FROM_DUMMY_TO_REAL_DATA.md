# Aliran data aplikasi saat ini

Panduan aktif, 5 Oktober 2026. Nama berkas dipertahankan agar tautan lama bekerja. Instruksi migrasi dummy, SQL tenant dan hash password dari versi awal sudah diganti.

## Data bisnis

Frontend memakai API Express di `/api`; backend berkomunikasi dengan Supabase dan storage. `frontend/src/data/dummy.ts` bukan sumber aplikasi saat ini. Fixture dalam `tests/` adalah data pengujian dan tidak perlu dihapus untuk memakai data real.

| Area UI | Sumber utama |
| --- | --- |
| Akun/profil | `/api/accounts`, `/api/users/me`, Supabase Auth. |
| Crew/direktori | `/api/crew`, `/api/admin-directory`. |
| Jadwal | `/api/admin-store-schedules`, assignment dan jadwal Store/Event. |
| Absensi | `/api/attendance`, `/api/admin-attendance`. |
| Guest | `/api/guest-attendance`, terpisah pada `guest_attendances`. |
| Event/workflow | `/api/admin-events`, `/api/crew-event`, `/api/event-workflows`. |
| Payroll | `/api/payroll`, `/api/payroll/me`, sumber dan snapshot database. |
| Audit/notifikasi | `/api/audit-logs`, `/api/notifications`. |

Ini kelompok route, bukan daftar izin CRUD semua pengguna. Periksa method dan pembatas server.

## Browser dan autentikasi

Token berada di memori `authSession.ts`; client menambahkan `Authorization` dan `X-FotoSnaps-Request`, tanpa `X-Tenant-Id`. Respons 401 pada request terlindungi mengakhiri sesi lokal dan memuat ulang halaman.

Tema/bahasa/preferensi dan riwayat legacy tertentu dapat berada di browser. Data lokal bukan bukti pengajuan tersimpan di server. Guest baru harus menerima sukses API; datanya tidak otomatis menjadi `attendance_logs` atau payroll karyawan.

## Memperbarui alur data

1. Temukan komponen pemilik state dan fungsi API yang digunakan.
2. Pastikan route, response shape dan otorisasi server sesuai.
3. Bedakan loading, kosong, gagal dan sukses. Jangan menutupi error dengan data contoh.
4. Tampilkan sukses setelah server menerima simpan; retry/idempotency mengikuti kontrak route.
5. Perbarui fixture dan tes. Respons rentang jadwal membedakan `created`, `inserted`, `updated` dan `lockedByAttendance`.
6. Untuk objek database baru, ikuti [panduan migrasi](../supabase/README.md) dan tes terisolasi.

## Foto, payroll dan inventory

Foto berada di bucket private. Object key database bukan URL publik; backend menyediakan signed URL.

Payroll sudah memiliki perhitungan, aturan, penyesuaian dan slip tersimpan. Jangan membuat tabel `payrolls` berdasarkan usulan lama; periksa `payroll_policies`, `payroll_adjustments`, `payroll_slips` serta RPC terkait.

Inventory Event membaca hasil workflow. Inventory stok/stock opname/waste Bujangan Food tidak dipasang di `app.js`; berkas router yang ada belum berarti endpoint aktif.

Gunakan [SETUP](SETUP.md) untuk menjalankan aplikasi dan [PRD aktif](PRD_ERD_CURRENT.md) untuk cakupan fitur.
