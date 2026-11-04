# Backend JAWARA

Express API untuk absensi dan operasional. Panduan aktif, 5 Oktober 2026, berdasarkan baseline `805c40b`.

## Menjalankan

Dari backend, setelah environment/database siap sesuai [SETUP](../docs/SETUP.md):

```powershell
npm ci
npm run dev
```

`npm start` menjalankan `src/server.js` tanpa watcher. Server memvalidasi environment, menghubungkan Redis bila dikonfigurasi, memasang app dan menjalankan pemeriksaan auto-start event. Default host `127.0.0.1`, port 4000; deployment memakai `HOST=0.0.0.0` dan port platform.

`GET /health` memeriksa proses. Semua route bisnis memakai prefix `/api`.

## Autentikasi dan akses

Alur terlindungi: security HTTP → token Supabase/status akun → role database → pembatas workspace → router/controller/RPC → penanganan error.

- Login, lupa sandi, verifikasi OTP, reset sandi dan pengajuan guest memiliki alur publik tersendiri.
- Backend memakai service-role client. RLS tidak menggantikan pemeriksaan aktor, kepemilikan dan scope backend/RPC.
- Head Store/ADMIN_STORE dibatasi workspace kota dan data pribadi; staff ke data pribadi; Event Manager ke operasi event dan data pribadi.
- Tidak ada tenantContext atau header X-Tenant-Id.
- Password login dikelola Auth; vault salinan terenkripsi adalah fitur terpisah.

## Kelompok route

| Prefix setelah `/api` | Modul |
| --- | --- |
| `/auth`, `/users/me` | Login, pemulihan password dan profil. |
| `/accounts`, `/head-store` | Akun/role dan monitoring kota. |
| `/crew`, `/admin-directory`, `/locations` | Personel, direktori dan geocoding. |
| `/admin-store-schedules`, `/crew-store/workspace` | Jadwal dan workspace personel. |
| `/admin-events`, `/crew-event`, `/event-workflows` | Event/workflow. |
| `/attendance`, `/admin-attendance`, `/guest-attendance` | Absensi, review dan guest. |
| `/permissions`, `/attendance-corrections`, `/overtimes` | Izin, koreksi dan lembur. |
| `/payroll` | Perhitungan, aturan, penyesuaian dan slip. |
| `/dashboard`, `/reports`, `/audit-logs`, `/notifications` | Ringkasan, laporan, audit/notifikasi. |

Route direktori lama, assignment/schedule dan equipment/checklist/inspection juga terpasang pada [app.js](src/app.js). Sebagian mutasi CRUD lama dinonaktifkan. Keberadaan router bukan izin untuk semua operasi; lihat method dan otorisasi masing-masing.

Modul inventory Bujangan Food tidak di-mount.

Pembaruan 24 Oktober 2026: `POST /attendance/:id/break/start` dan `/end` menerima foto kamera serta GPS milik crew yang login. `GET /permissions` membaca pengajuan sendiri (Super Admin dapat membaca semua), `POST /permissions` mengirim izin/sakit, dan `PATCH /permissions/:id` menyimpan keputusan Super Admin. Pengaturan istirahat tersedia melalui route jadwal store dan `PATCH /admin-events/:id/schedules/:scheduleId/break`. Terapkan migrasi `20261023150118_shift_breaks_permissions.sql` dahulu; lihat [panduan fitur](../docs/ISTIRAHAT_IZIN_JADWAL.md).

## Perintah dan tes

- `npm run bootstrap-admin`: admin pertama; lihat [panduan akun](../docs/ADMIN_CREW_ACCOUNTS.md).
- `npm run check-email`: baca script untuk cakupan pemeriksaannya; bukan bukti otomatis email telah diterima.
- `npm run lint`: lint source backend menggunakan konfigurasi ESLint repository.
- `npm test`: `*.test.cjs` dan security, belum `*.test.js`.
- `npm run test:security`: subset tes keamanan.
- [Checklist rilis](../docs/RELEASE_CHECKLIST.md) menjelaskan tes lengkap. PGlite membutuhkan `PGLITE_MODULE`; tanpa itu tes SQL tertentu skip.

Sumber integrasi: [HTTP/security](src/security/http.js), [Supabase](src/config/supabaseClient.js), [storage](src/config/s3Client.js), [OTP](src/utils/otpEmail.js).
