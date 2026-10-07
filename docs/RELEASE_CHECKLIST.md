# Checklist rilis JAWARA

Panduan aktif, 5 Oktober 2026. Ini kriteria pemeriksaan, bukan klaim seluruh item sudah lulus pada setiap environment.

## Persiapan

- Catat commit frontend/backend dan scope perubahan.
- Cocokkan schema/RPC tujuan dengan kode; lihat [panduan database](../supabase/README.md).
- Siapkan backup/pemulihan untuk perubahan data. Reset production bukan langkah upgrade.
- Periksa runtime, environment, CORS, Redis, bucket private, pengirim OTP dan kunci vault.
- Tentukan akun/data uji; hindari transaksi payroll nyata untuk smoke test.

## Tes otomatis

Install dependency melalui `npm ci` pada backend/frontend. Dari root repository:

```powershell
node --test --test-concurrency=1 backend/tests/*.test.cjs backend/tests/*.test.js backend/tests/security/*.test.cjs
```

Dari folder frontend:

```powershell
node --experimental-vm-modules --test tests/*.test.mjs tests/crew-csv.test.cjs tests/employment-alignment.test.cjs tests/report-exports.test.cjs tests/location-budget.test.cjs
npx tsc --noEmit
npm run build
```

Tes SQL memakai PGlite melalui `PGLITE_MODULE`; tanpa variabel itu sebagian tes skip. Catat jumlah skip bersama angka lulus. [Workflow CI](../.github/workflows/update-verification.yml) memasang alat terisolasi `@electric-sql/pglite@0.5.8`, `playwright@1.62.1` dan Chromium.

Untuk tes browser lokal, siapkan alat tersebut, arahkan `PLAYWRIGHT_MODULE` ke modul Playwright dan `QA_OUTPUT_DIR` ke direktori hasil di luar source, lalu build frontend. Jalankan suite dari frontend, misalnya `node tests/staff-v13-browser.cjs`. Suite memakai server/fixture lokal; bukan uji integrasi production.

Cakupan browser CI: crew/admin, Head Store, password akun, guest, staff/shift, role V14, audit, payroll, dashboard, maps dan bahasa. Pastikan kegagalan suite awal tidak membuat suite selanjutnya terlupakan.

## Uji penerimaan

- Login/logout, password salah, akun nonaktif/tanpa role, refresh/tab baru dan batas akses.
- Personel, role/divisi/cakupan, penempatan, jadwal individu/massal, tiga shift dan shift malam.
- Rentang lintas bulan, konflik/event, libur belum tersedia, retry dan jadwal yang memiliki absensi.
- Check-in/out, kamera/GPS ditolak, upload gagal, retry, review dan riwayat sendiri.
- Guest sukses hanya setelah diterima API; muncul pada tinjauan guest, tidak otomatis menjadi absensi karyawan.
- Event penugasan sah, bukti/workflow, rekap dan keadaan selesai.
- Payroll aturan/penyesuaian, blocking periode/review, snapshot final, reopen dan pencatatan bayar pada data uji. Tidak ada transfer bank otomatis.
- Ekspor/audit sesuai scope tanpa password; desktop/mobile, tema dan bahasa.

## Penerapan

1. Terapkan migrasi yang telah ditinjau sesuai kompatibilitas backend lama/baru.
2. Deploy backend; cek startup, health, log dan dependency. `/health` sendiri tidak mengecek dependency.
3. Deploy frontend dengan origin API yang benar.
4. Uji login dan alur utama dengan akun uji; catat commit dan hasilnya.
5. Jika gagal, nilai kompatibilitas schema sebelum rollback kode; jangan menghapus data untuk memaksa versi lama berjalan.

Simpan bukti tes, skip, warning dan batas verifikasi dalam catatan rilis bertanggal. Status `live` atau build lulus saja belum membuktikan semua alur siap.

## Payroll dan jadwal — 6 Oktober 2026

- [ ] Migrasi `20261005160149_payroll_schedule_time_off.sql` diuji dan diterapkan setelah prasyarat payroll diverifikasi.
- [ ] Migrasi `20261006100934_payroll_annual_calendar.sql` diterapkan sesudah migrasi di atas; default tanggal lama tetap akhir bulan/bayar tanggal 1 bulan berikutnya sampai admin menyimpan aturan baru.
- [ ] Aturan tahunan dipratinjau dan disimpan dari bulan mulai sampai Desember; bulan sebelumnya serta slip final/dibayar dipertahankan.
- [ ] Batas 25/bayar 30, Februari kabisat/nonkabisat, shift malam, transisi rentang, dan batas Desember–Januari diperiksa. Perubahan batas yang menyentuh slip final/dibayar ditolak.
- [ ] Jadwal tanggal merah tetap bisa dibuat; libur/izin crew dibedakan di kalender.
- [ ] Clock-in libur/izin ditolak, pemulihan kerja mengaktifkan shift awal, tanggal berabsensi/final terkunci.
- [ ] Pratinjau aturan dan penyesuaian banyak crew sesuai nominal sebelum/sesudah; slip final/dibayar tetap utuh.
- [ ] Alur payroll/jadwal diperiksa pada desktop dan ponsel.
