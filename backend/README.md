# Backend — FotoSnaps & Bujangan Food API

Express.js REST API sesuai **API Baseline** di Master PRD & ERD v2.0 (lihat `/docs`). Terhubung ke database PostgreSQL/Supabase yang skemanya ada di `../database`.

## Struktur folder

```
backend/
├── src/
│   ├── config/            # Koneksi Supabase, S3, konstanta bisnis (geofence, threshold, dll)
│   ├── middlewares/        # authenticate (JWT), tenantContext (RLS scope), requireRole (RBAC), errorHandler
│   ├── utils/               # geofence (Haversine), imageCompression, signedUrl (S3), auditLogger, crudFactory
│   ├── modules/
│   │   ├── auth/                # POST /auth/login, /logout, GET /auth/me
│   │   ├── tenants/              # GET/POST/PATCH /tenants (SUPER_ADMIN)
│   │   ├── users/                 # GET/POST/PATCH /users
│   │   ├── crew/                   # GET/POST/PATCH /crew
│   │   ├── stores/                  # /stores, /store-assignments, /store-schedules
│   │   ├── events/                   # /events, /event-locations, /event-assignments, /event-schedules
│   │   ├── attendance/                 # check-in/out (geofence+anti-fraud), /permissions, /attendance-corrections, /overtimes
│   │   ├── inventory/                   # /inventory-items, /inventory-stocks (ROP alert), /stock-opname (approval >2%), /waste
│   │   ├── equipment/                    # /equipment-assets, /event-asset-assignments, /event-checklists, /inspection-reports (Auto-PDF)
│   │   ├── dashboard/                     # GET /dashboard/admin, /dashboard/crew
│   │   ├── reports/                        # GET /reports/attendance, /inventory, /events
│   │   ├── auditLogs/                       # GET /audit-logs (read-only)
│   │   └── notifications/                    # GET /notifications, PATCH /notifications/:id/read
│   ├── app.js               # Wiring seluruh route + middleware chain
│   └── server.js            # Entry point
├── package.json
└── .env.example
```

## Alur request (middleware chain)

```
Request → helmet/cors/json → [/auth/* publik ATAU authenticate (JWT)] → tenantContext (validasi user_tenants + set RLS) → requireRole (jika endpoint butuh role tertentu) → controller → errorHandler
```

- **`authenticate`** — verifikasi JWT dari header `Authorization: Bearer <token>`.
- **`tenantContext`** — wajib header `X-Tenant-Id`; memvalidasi keanggotaan lewat tabel `user_tenants` (bukan dipercaya mentah dari client), lalu men-set `req.tenantId`, `req.role`, dan session variable Postgres untuk RLS.
- **`requireRole(...roles)`** — dipasang per-route sesuai RBAC di PRD Section 3.

## Cara menjalankan

```bash
cd backend
npm install
cp .env.example .env   # lalu isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, S3_*, dan konfigurasi email
npm run dev
```

Pastikan database sudah di-migrate terlebih dahulu — lihat `../database/README.md`.

Kalender kerja memakai Google Calendar API. Isi `GOOGLE_CALENDAR_API_KEY` pada `backend/.env` dan aktifkan Google Calendar API di project Google Cloud. Kalender publik default adalah `id.indonesian#holiday@group.v.calendar.google.com`. Backend menyimpan hasil sinkronisasi di Supabase selama 30 hari agar jadwal tetap dapat dibaca saat Google sedang gagal. OAuth tidak diperlukan karena aplikasi hanya membaca kalender publik.

## Modul dengan business logic khusus (bukan CRUD polos)

| Modul | Logika khusus |
|---|---|
| `attendance` | Validasi geofence (Haversine, radius default 50m → HTTP 422 jika di luar radius), kompresi foto live-capture, `check_out` tidak bisa sebelum `check_in` |
| `attendanceCorrections` | Approval wajib sebelum data `attendance_logs` diubah, tercatat ke `audit_logs` |
| `stockOpname` | Auto-hitung `discrepancy_percent`, status otomatis `REQUIRES_ADMIN_APPROVAL` jika >2%, sinkron `inventory_stocks` saat disetujui |
| `eventAssetAssignments` | Update status aset (`AVAILABLE` ⇄ `IN_USE` ⇄ `MAINTENANCE`) mengikuti siklus pinjam-kembali |
| `inspectionReports` | Generate PDF in-memory (PDFKit) dari data checklist, upload ke private S3, target <3 detik (di-log jika melebihi) |

## Catatan keamanan (PRD Section 12)

- Semua endpoint (kecuali `/auth/login`) butuh JWT valid.
- Tenant scope **selalu** divalidasi ulang di `tenantContext` — tidak pernah dipercaya dari body/query/header tanpa verifikasi ke `user_tenants`.
- Password di-hash dengan `bcrypt` sebelum disimpan (lihat kolom `password_hash`, bukan plaintext).
- File foto/PDF tidak pernah diserve langsung — selalu lewat `getSignedDownloadUrl` (kedaluwarsa otomatis).
