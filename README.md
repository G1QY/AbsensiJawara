# FotoSnaps & Bujangan Food — Sistem Informasi Operasional Terpadu

> Revisi terbaru: mulai dari [Dashboard, Event, Email Crew, dan Payroll](docs/ADMIN_EVENT_PAYROLL_OTP.md). Panduan ini melanjutkan [Absensi, Guest, Review, dan Excel](docs/ABSENSI_REVIEW_EXCEL.md) serta [Admin, Crew, dan Cabang](docs/ADMIN_CREW_CABANG.md). Penjelasan arsitektur awal di bawah adalah arsip; status implementasi dan urutan migrasi mengikuti panduan terbaru.

Monorepo ini dipisah menjadi tiga bagian utama sesuai kebutuhan sistem full-stack, mengikuti **Master PRD & ERD v2.0** (`docs/PRD_ERD_MASTER_BujanganFood_FotoSnaps_v2_0.pdf`):

```
fotosnaps-system/
├── frontend/     # React + Vite + Tailwind — UI/UX (mockup interaktif, siap disambungkan ke API)
├── backend/      # Express.js REST API — auth, RBAC, business logic, integrasi S3
├── database/     # PostgreSQL/Supabase — migrations, RLS policies, seed data
└── docs/         # Dokumen acuan tim: PRD/ERD Master & Design System (Obsidian Aperture)
```

## Kenapa dipisah begini?

Sebelumnya seluruh kode ada dalam satu folder frontend saja (project mockup UI dengan dummy data). Sekarang dipisah supaya:

1. **Frontend** bisa terus dikembangkan tim UI/UX secara independen (styling, komponen, responsivitas) tanpa menyentuh logika server.
2. **Backend** punya struktur modular per-domain (auth, attendance, inventory, equipment, dst.) yang memetakan langsung ke **API Baseline** di PRD Section 13 — memudahkan tim backend membagi tugas per modul.
3. **Database** punya migration & RLS policy terpisah dari kode aplikasi, sesuai keputusan arsitektur PRD (*shared database multi-tenant dengan Row Level Security*) — bisa di-review & dijalankan independen lewat Supabase SQL Editor atau CLI.
4. Tim reviewer/dosen pembimbing bisa langsung melihat pemisahan **presentation layer / application layer / data layer** sesuai standar rekayasa perangkat lunak.

## Alur data singkat

```
┌────────────┐      HTTPS + JWT       ┌────────────┐      Supabase client      ┌──────────────┐
│  frontend  │ ─────────────────────▶ │  backend   │ ─────────────────────────▶│   database   │
│ (React/    │  header:                │ (Express)  │   (RLS by tenant_id)     │ (PostgreSQL/  │
│  Vite)     │  Authorization: Bearer  │            │                           │  Supabase)    │
│            │  X-Tenant-Id: <uuid>    │            │ ─── signed URL ─────────▶│  Private S3   │
└────────────┘                         └────────────┘                           └──────────────┘
```

- Frontend mengirim JWT (`Authorization`) + tenant aktif (`X-Tenant-Id`) di setiap request.
- Backend memvalidasi keduanya, lalu meneruskan query ke Supabase dengan RLS otomatis membatasi data sesuai tenant.
- Foto absensi, waste, checklist, dan PDF inspection report tidak pernah diakses langsung — selalu lewat **signed URL** dari private S3 bucket.

## Status implementasi saat ini

| Bagian | Status |
|---|---|
| `frontend/` | ✅ UI/UX lengkap untuk 3 role (Admin, Crew Event, Crew Store) dengan dummy data — **belum** disambungkan ke `backend/` (masih pakai data statis di `src/data/dummy.ts`) |
| `backend/` | ✅ Struktur modul & routing lengkap sesuai API Baseline, logika bisnis inti (geofence, stock opname approval, Auto-PDF) sudah ditulis — **belum** teruji jalan (butuh `npm install` + kredensial Supabase/S3 asli) |
| `database/` | ✅ Skema lengkap 4 migration + RLS policy + seed — **belum** dijalankan ke instance Supabase sungguhan |

## Langkah selanjutnya untuk menyambungkan ketiganya

1. Buat project di [Supabase](https://supabase.com), jalankan migration di `database/migrations/` secara berurutan lewat SQL Editor.
2. Jalankan `database/policies/rls_policies.sql`, lalu `database/seeds/001_roles_and_tenants.sql` untuk data awal.
3. Isi `backend/.env` dengan kredensial Supabase & S3 (lihat `backend/.env.example`), lalu `npm install && npm run dev`.
4. Di `frontend/`, ganti pemanggilan `src/data/dummy.ts` dengan `fetch`/axios ke endpoint backend (`http://localhost:4000`) — mulai dari modul Absensi yang jadi tanggung jawab tim kalian.
5. Tambahkan `.env` di frontend untuk `VITE_API_BASE_URL` dan sertakan header `Authorization` + `X-Tenant-Id` di setiap request (lihat `backend/src/middlewares/tenantContext.js` untuk kontrak yang diharapkan).

## Dokumen acuan

- `docs/PRD_ERD_MASTER_BujanganFood_FotoSnaps_v2_0.pdf` — spesifikasi produk & data lengkap (RBAC, ERD, business rules, API baseline, roadmap).
- `docs/DESIGN.md` — design system "Obsidian Aperture" (warna, tipografi, komponen) yang dipakai di halaman Login.
# Revisi Admin dan Cabang

Untuk revisi terbaru, ikuti [panduan pemasangan Admin, Crew, Cabang & Store](docs/ADMIN_CREW_CABANG.md).
Jalankan migrasi `20260831110840_admin_branches_crew.sql` sekali setelah migrasi 001–009, lalu restart backend dan frontend.
