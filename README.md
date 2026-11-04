# Sistem Absensi JAWARA - Bujangan Wajib Sejahtera

Repository ini berisi monorepo untuk aplikasi operasional JAWARA yang mencakup front-end, back-end, database/Supabase, dokumentasi, serta konfigurasi deployment.

## Ringkasan proyek

Pembaruan terbaru: [istirahat shift dengan foto, pengajuan izin/sakit, dan kalender kerja](docs/ISTIRAHAT_IZIN_JADWAL.md). Fitur mengikuti source pada checkout; penerapan production perlu migrasi dan deployment yang sesuai.

- `frontend/` — aplikasi React + Vite + TypeScript + Tailwind untuk UI admin, crew, guest, dan portal absensi.
- `backend/` — API Express.js untuk autentikasi, absensi, event, payroll, crew, store, serta integrasi Supabase/S3.
- `database/` — migration SQL untuk struktur database dan data awal.
- `supabase/` — konfigurasi Supabase, seed, dan migrasi terkait lingkungan lokal/produksi.
- `docs/` — panduan fitur, desain, migration, dan catatan update proyek.
- `deployment/` — konfigurasi deployment dan reverse proxy (`Caddyfile`).
- `scripts/` — utility operasional seperti backup database dan pengecekan secret.

## Teknologi utama

- Frontend: React 19, Vite 8, TypeScript, Tailwind CSS 4
- Backend: Node.js, Express.js, Supabase JS SDK, AWS S3 SDK
- Database: PostgreSQL / Supabase
- Testing: Node test runner, pengujian SQL dengan PGlite, TypeScript, build, dan alur browser dengan Playwright

## Struktur folder

```text
AbsensiJawara/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── scripts/
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
├── database/
│   ├── migrations/
│   └── README.md
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── docs/
├── deployment/
├── scripts/
├── render.yaml
├── README.md
└── .gitignore
```

## Persiapan lingkungan

### 1) Clone repositori

```bash
git clone https://github.com/G1QY/AbsensiJawara.git
cd AbsensiJawara
```

### 2) Install dependensi

Gunakan Node.js 24 sesuai CI. Siapkan environment dan database uji mengikuti [SETUP](docs/SETUP.md) sebelum menjalankan aplikasi.

Frontend:

```bash
cd frontend
npm ci
```

Backend:

```bash
cd backend
npm ci
```

## Menjalankan aplikasi

### Frontend development

```bash
cd frontend
npm run dev
```

Frontend biasanya berjalan di:

- `http://localhost:8443` (atau nilai `PORT` yang dipakai Vite).

### Frontend production build

```bash
cd frontend
npm run build
```

### Backend development

```bash
cd backend
npm run dev
```

### Backend production

```bash
cd backend
npm start
```

## Menjalankan test

Backend test:

```bash
cd backend
npm test
```

Test keamanan tambahan:

```bash
cd backend
npm run test:security
```

## Database dan Supabase

Proyek ini memanfaatkan SQL migrations yang berada di beberapa folder:

- `database/migrations/`
- `supabase/migrations/`

Ikuti [panduan database](supabase/README.md); kedua folder tidak boleh diterapkan berulang tanpa memeriksa skema dan histori migrasi. Untuk pembaruan ini, pasang `20261005160149_payroll_schedule_time_off.sql`, lalu `20261006100934_payroll_annual_calendar.sql` setelah prasyarat payroll tersedia. Rekonsiliasi lebih dahulu jika objek payroll sudah ada tetapi histori migrasinya berbeda.

Pembaruan istirahat/izin membutuhkan `20261023150118_shift_breaks_permissions.sql` sebelum backend/frontend baru digunakan. Migrasi sebelumnya untuk mode lokasi crew (`20261008043901`) juga harus tersedia.

## Variabel lingkungan

Daftar environment backend/frontend terdapat di [SETUP](docs/SETUP.md). Frontend memakai `VITE_API_BASE_URL` tanpa akhiran `/api`. Supabase service-role key, S3, Resend dan kunci vault hanya berada di backend; jangan memasukkannya ke Git atau variabel `VITE_*`.

## Dokumentasi penting

Dokumen utama yang paling relevan saat ini:

- [Payroll dan jadwal](docs/PAYROLL_JADWAL.md) — aturan bisnis dan pembaruan terbaru.
- [Istirahat, izin/sakit, dan kalender kerja](docs/ISTIRAHAT_IZIN_JADWAL.md) — pengaturan per shift, foto istirahat, persetujuan izin, dan libur nasional.
- [PRD dan relasi data](docs/PRD_ERD_CURRENT.md) — cakupan aplikasi, role dan model data.
- [Akun dan hak akses](docs/ADMIN_CREW_ACCOUNTS.md) — bootstrap admin, akses dan pemulihan password.
- [GPS dan watermark foto absensi](docs/ABSENSI_GPS_WATERMARK.md) — perilaku desktop/mobile, nama jalan, dan penanganan layanan alamat.
- [Setup](docs/SETUP.md) — environment, dependency dan deployment.
- [Desain](docs/DESIGN.md) — komponen dan perilaku UI.
- [Checklist rilis](docs/RELEASE_CHECKLIST.md) — verifikasi sebelum dan setelah penerapan.

## Deployment

Konfigurasi deployment tersedia di:

- `render.yaml`
- `deployment/Caddyfile`

## Catatan repository

- README ini diperbarui untuk mencerminkan struktur repositori saat ini.
- Beberapa fitur masih sangat bergantung pada konfigurasi environment real (Supabase/S3) agar dapat berjalan penuh.
- Jika Anda ingin mengembangkan fitur baru, pastikan untuk mengikuti pola modularisasi backend dan dokumentasi yang ada di `docs/`.
