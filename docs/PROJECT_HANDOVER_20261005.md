# Analisis dan titik lanjut AbsensiJawara

Tanggal pemeriksaan: 5 Oktober 2026 (WIB).
Baseline: `main`, commit `805c40b48ad3bd73ac5eb13fcee0b4c84b029421` (30 September 2026).

## Kesimpulan

Proyek sudah memiliki implementasi operasional yang cukup luas dan deployment aktif. Titik lanjut yang paling masuk akal adalah menstabilkan verifikasi jadwal/shift, mencocokkan riwayat migrasi dengan database aktual, dan memastikan kesiapan email OTP sebelum menambah fitur.

Analisis ini mencakup kode dan dokumentasi terpilih, GitHub Actions, metadata deployment Render, metadata/skema/izin Supabase, serta status domain Resend. Ini bukan audit keamanan menyeluruh atau pengujian seluruh alur produksi. Tidak ada akun, data bisnis, konfigurasi cloud, pengiriman email, maupun deployment yang diubah.

## Baseline dan akses

| Komponen | Hasil pemeriksaan |
| --- | --- |
| GitHub | Repo `G1QY/AbsensiJawara` dapat diakses; default branch `main`. HEAD lokal sama dengan HEAD remote yang dibaca. Checkout bersih sebelum analisis. |
| Render UI | `AbsensiJawara-ui`, static site, root `frontend`, deployment terakhir `live` pada commit baseline. |
| Render API | `AbsensiJawara`, Node web service, root `backend`, region Singapore, plan free, deployment terakhir `live` pada commit baseline. |
| Supabase | Project JAWARA berstatus `ACTIVE_HEALTHY`, PostgreSQL 17; 34 tabel pada schema public yang terdaftar semuanya memiliki RLS aktif. |
| Resend | Domain `fotosnaps.id` dan `mail.fotosnaps.id` sama-sama berstatus `not_started`. |
| Konteks ChatGPT | Tautan share dan project tidak berhasil dibaca. Percobaan browser untuk tautan share juga timeout. Isi percakapan dan keputusan dari project tersebut belum menjadi sumber analisis ini. |

UI: https://absensijawara-ui.onrender.com

API: https://absensijawara.onrender.com

Status `live` berasal dari Render. Akses HTTP langsung melalui alat web tidak berhasil; alur login, absensi, upload foto, serta OTP produksi belum diuji dari awal sampai akhir.

## Arsitektur yang benar-benar digunakan

- Frontend: React 19, Vite 8, TypeScript, Tailwind 4; antarmuka berdasarkan role.
- Backend: Express, API bisnis di bawah `/api`; `/health` berada di luar prefix tersebut.
- Login memakai Supabase Auth. Middleware backend memverifikasi pengguna dan mengambil role dari database.
- Keputusan arsitektur dalam dokumentasi: satu database per perusahaan; database saat ini khusus FotoSnaps. `tenantContext` dan `X-Tenant-Id` sudah tidak digunakan.
- Foto/bukti memakai utilitas penyimpanan dan signed URL; kode juga memuat integrasi S3. Konfigurasi serta akses penyimpanan produksi belum diverifikasi.
- OTP reset password dikirim melalui Resend HTTP API, memakai `RESEND_API_KEY` dan `OTP_EMAIL_FROM` pada backend.
- Redis digunakan untuk pembatasan permintaan dan cache/koordinasi tertentu. Validasi production mewajibkan `REDIS_URL`; nilai konfigurasi dan koneksi Redis produksi belum diperiksa.
- Inventory Bujangan Food masih berupa modul yang tidak dipasang di `app.js`. Dokumen repo menunda pekerjaan ini sampai fondasi FotoSnaps stabil.

## Cakupan fitur saat ini

| Area | Implementasi yang ditemukan |
| --- | --- |
| Akun dan personel | Crew, profil, penempatan, role, divisi, Head Store, Event Manager, staff kantor/produksi, dan pusat Akun & Hak Akses. |
| Jadwal | Jadwal individu/massal/rentang, tiga shift, lintas tengah malam, kalender libur, serta pengiriman rentang per bulan. |
| Absensi | Check-in/out, lokasi dan bukti foto, guest, tinjauan admin, izin, koreksi, dan lembur. |
| Event | Penugasan, workspace crew, workflow operasional, bukti, rekap, dan pembatasan Event Manager. |
| Payroll | Aturan periode, penyesuaian karyawan, Draft → Final → Dibayar, snapshot slip, dan payroll pribadi. Pembayaran uang dilakukan di luar aplikasi. |
| Pelaporan | Ekspor, dashboard, notifikasi, dan audit log. |

Dokumentasi terbaru yang relevan adalah `UPDATE_V14_ROLE_ACCOUNTS_PAYROLL.md` dan `UPDATE_V14_2_AUDIT_LOG.md`, dilanjutkan commit perbaikan jadwal/shift pada 30 September. README utama masih menunjuk catatan 7 September sebagai update terbaru.

## Temuan dan urutan prioritas

### 1. Verifikasi browser gagal karena kontrak fixture jadwal tertinggal

GitHub Actions pada commit baseline:

- Security checks: **success**.
- Crew and event verification: **failure**.
- Di job kedua, **102 tes backend/migrasi lulus tanpa skip**, **35 tes frontend lulus**, TypeScript dan build lulus.
- Kegagalan terjadi di `frontend/tests/staff-v13-browser.cjs:51`: menunggu teks `1 jadwal baru dibuat.` selama 10 detik.

Penyebab yang didukung pembacaan kode:

- Fixture respons jadwal pada baris 33 mengembalikan `created: 1`, tetapi tidak mengembalikan `inserted`.
- `frontend/src/lib/scheduleRange.ts` menjumlahkan `inserted`, dan nilai yang tidak ada menjadi nol.
- `StoreScheduleManager.tsx` menampilkan jumlah jadwal baru dari `result.inserted`.
- Backend sebenarnya mengembalikan `created`, `inserted`, `updated`, dan `lockedByAttendance` pada hasil rentang.

Jadi ada ketidaksesuaian nyata antara fixture dan kontrak backend/UI. Ini merupakan penjelasan kuat untuk timeout CI, tetapi belum diverifikasi melalui rerun browser setelah perbaikan. Ada potensi kegagalan lanjutan: tes edit shift menunggu teks `diperbarui.`, sedangkan UI kini menampilkan `berhasil diubah ke Shift ...`.

Titik lanjut: perbarui fixture dan pemeriksaan pesan sesuai kontrak, tetap periksa isi request serta jadwal yang tampil, kemudian jalankan ulang seluruh rangkaian browser. Pada run yang gagal, suite role V14, audit, payroll, dashboard, dan maps yang dijalankan setelah titik gagal belum mendapat verifikasi lengkap untuk commit ini.

Sumber: https://github.com/G1QY/AbsensiJawara/actions/runs/36689019653

Security checks: https://github.com/G1QY/AbsensiJawara/actions/runs/36689019583

### 2. Riwayat migrasi payroll tidak selaras dengan objek database

Repo memiliki `20260925222422_persisted_payroll.sql`, tetapi versi tersebut tidak ditemukan dalam daftar sembilan migrasi yang tercatat di Supabase. Tabel `payroll_policies`, `payroll_adjustments`, `payroll_slips` serta fungsi `payroll_source`, `payroll_workspace`, dan `mutate_payroll` sudah ada.

Pemeriksaan izin menunjukkan tiga fungsi payroll tidak dapat dieksekusi oleh `anon`/`authenticated`, tetapi dapat dieksekusi oleh `service_role`. Grant tabel payroll yang terlihat juga tidak memberikan akses kepada `anon`/`authenticated`. Ini mendukung desain akses melalui backend.

Belum dapat disimpulkan bahwa migrasi payroll belum diterapkan, atau bahwa seluruh definisinya identik. Perlu perbandingan kolom, constraint, indeks, fungsi, serta grant sebelum memperbaiki catatan migrasi. Jangan menjalankan ulang SQL `create table` secara langsung terhadap database yang sudah memiliki tabel tersebut.

Titik lanjut: buat baseline skema yang dapat dibangun ulang pada database uji; cocokkan perubahan production, baru rekonsiliasi riwayat migrasi secara terkontrol.

### 3. Kesiapan pengiriman OTP perlu diselesaikan

Domain pada akun Resend yang terhubung berstatus `not_started`. Kode OTP tersedia dan menangani penolakan domain, mode uji, izin, serta kuota. Pengirim aktual backend belum diperiksa, sehingga belum dipastikan domain mana yang dipakai production atau apakah akun Resend ini sama dengan API key yang dipasang.

Titik lanjut: cocokkan domain `OTP_EMAIL_FROM`, akun pengiriman, dan status DNS/domain; kemudian uji reset password dengan penerima uji yang ditentukan. Pemeriksaan ini belum mengirim email.

### 4. Konfigurasi deployment dan panduan setup perlu diselaraskan

- Render API aktual memiliki `healthCheckPath` kosong, sedangkan `render.yaml` menentukan `/health`.
- Blueprint memakai nama layanan `fotosnaps-demo-*`, sedangkan layanan aktif bernama `AbsensiJawara*`; jangan menganggap blueprint merupakan salinan konfigurasi production.
- Backend README masih menjelaskan tenant, header, dan hashing password dari desain lama yang bertentangan dengan kode dan Supabase README.
- Nama migrasi dasar pada Supabase README tidak cocok dengan berkas yang tersedia; terdapat SQL tanpa timestamp dan beberapa pasangan berkas duplikat.
- Runtime lokal yang diperiksa adalah Node 26.4.0; CI memakai Node 24 dan blueprint menyebut Node 22.22.0. Runtime Render aktual belum diverifikasi.

Titik lanjut: dokumentasikan setup aktual, satu jalur migrasi yang dapat direproduksi, runtime yang disepakati, environment template tanpa secret, dan konfigurasi health check.

### 5. Catatan advisor Supabase dan performa frontend

Advisor melaporkan warning untuk `public.is_admin(uuid)` yang memakai SECURITY DEFINER dan callable oleh pengguna login, serta leaked-password protection yang nonaktif. Warning fungsi membutuhkan peninjauan isi dan tujuan akses; status advisor saja bukan bukti eksploitasi.

Advisor juga mencatat RLS tanpa policy pada tabel payroll dan vault private. Khusus payroll, tidak adanya policy selaras dengan desain akses backend/service-role dan pencabutan grant browser; jangan menambahkan policy terbuka hanya untuk menghilangkan pesan advisor.

Referensi advisor:

- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Build lokal berhasil, dengan bundle JavaScript utama sekitar 1.32 MB sebelum gzip (sekitar 388 KB gzip). Impor PDF statis dan dinamis bercampur sehingga pemisahan bundle tidak efektif. Optimasi ini relevan untuk penggunaan mobile, setelah stabilitas fungsi utama terkonfirmasi.

## Verifikasi lokal 5 Oktober

- Tes regresi frontend: **35 lulus, 0 gagal, 0 skip**.
- Pemeriksaan TypeScript (`tsc --noEmit`): **lulus**, exit code 0.
- Production build frontend: **lulus**, dengan peringatan bundle dan impor PDF di atas.
- Tes backend awal terhambat sandbox `connect EACCES 127.0.0.1`. Pengulangan di luar sandbox selesai: **94 lulus, 0 gagal, 8 skip** dari 102 tes.
- Delapan tes database lokal dilewati karena PGlite belum tersedia. Sebagai bukti terpisah, run CI baseline menjalankan 102 tes backend/migrasi dan seluruhnya lulus tanpa skip.
- Tidak dilakukan tes transaksi terhadap database production, pengujian pembayaran, atau pengiriman OTP nyata.

## Paket pekerjaan lanjutan yang disarankan

1. **Stabilkan verifikasi jadwal/shift.** Perbaiki fixture dan assertion, jalankan seluruh tes browser, pastikan tidak ada suite penting terlewat.
2. **Reproduksi database dan setup.** Cocokkan skema payroll, rapikan panduan migrasi/setup, uji bootstrap pada database terpisah.
3. **Validasi integrasi produksi.** Cek health endpoint, Redis, penyimpanan foto, domain OTP, lalu uji alur login → jadwal → absensi → review → payroll menggunakan akun uji yang disepakati.
4. **Pilih pengembangan berikutnya.** Misalnya delegasi hak payroll ke Finance, penyempurnaan jadwal, atau optimasi mobile. Scope fitur harus mengikuti keputusan pemilik proyek dan konteks percakapan lama yang belum terbaca.

Kriteria baseline siap dikembangkan: seluruh pemeriksaan CI lulus, database uji dapat dibangun dari repo, konfigurasi deployment terdokumentasi sesuai layanan aktual, dan alur utama lulus pengujian integrasi yang terkontrol.
