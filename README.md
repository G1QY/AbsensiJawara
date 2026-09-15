# Sistem Absensi JAWARA - Bujangan Wajib Sejahtera

Repository ini berisi monorepo untuk aplikasi operasional JAWARA yang mencakup front-end, back-end, database/Supabase, dokumentasi, serta konfigurasi deployment.

## Ringkasan proyek

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
- Testing: Node test runner untuk backend, serta frontend build validation

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
git clone <url-repository>
cd AbsensiJawara
```

### 2) Install dependensi

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd backend
npm install
```

## Menjalankan aplikasi

### Frontend development

```bash
cd frontend
npm run dev
```

Frontend biasanya berjalan di:

- `http://localhost:5173`

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

Gunakan migration yang relevan sesuai kebutuhan environment Anda. Pastikan konfigurasi Supabase dan variabel lingkungan backend sudah diisi sebelum menjalankan fitur yang bergantung pada data real.

## Variabel lingkungan

Untuk backend yang berjalan dengan data real, pastikan file `.env` sudah disiapkan sesuai kebutuhan project. Beberapa bagian aplikasi memerlukan konfigurasi Supabase, S3, dan token/secret yang berkaitan dengan autentikasi dan upload file.

## Dokumentasi penting

Dokumen utama yang paling relevan saat ini:

- `docs/ABSENSI_REVIEW_EXCEL.md` — fitur absensi, guest, review, dan export Excel
- `docs/ADMIN_CREW_CABANG.md` — panduan admin, crew, cabang, dan store
- `docs/ADMIN_EVENT_PAYROLL_OTP.md` — update dashboard, event, email crew, dan payroll
- `docs/UPDATE_20260907.md` — catatan update terbaru
- `docs/DESIGN.md` — panduan design system

## Deployment

Konfigurasi deployment tersedia di:

- `render.yaml`
- `deployment/Caddyfile`

## Catatan repository

- README ini diperbarui untuk mencerminkan struktur repositori saat ini.
- Beberapa fitur masih sangat bergantung pada konfigurasi environment real (Supabase/S3) agar dapat berjalan penuh.
- Jika Anda ingin mengembangkan fitur baru, pastikan untuk mengikuti pola modularisasi backend dan dokumentasi yang ada di `docs/`.

## Quick start summary

```bash
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
```

Setelah itu, sesuaikan konfigurasi Supabase dan environment lain agar fitur yang memerlukan data real dapat dijalankan dengan benar.
