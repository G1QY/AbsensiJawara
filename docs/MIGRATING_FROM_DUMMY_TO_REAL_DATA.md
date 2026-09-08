# Migrasi dari Dummy Data ke Database PostgreSQL Asli

Dokumen ini menjelaskan **apa yang sudah dikerjakan otomatis** dan **langkah yang perlu kamu lakukan sendiri** untuk menghilangkan `src/data/dummy.ts` sepenuhnya dan menggantinya dengan data asli dari PostgreSQL (lewat backend Express).

## 0. Prasyarat — jalankan dulu database & backend

Data tidak akan muncul di frontend kalau database & backend belum hidup. Urutannya **wajib**:

```bash
# 1) Database — jalankan migration + RLS + seed di Supabase (SQL Editor atau psql)
#    Lihat database/README.md untuk detail
psql -d fotosnaps_db -f database/migrations/001_foundation.sql
psql -d fotosnaps_db -f database/migrations/002_attendance.sql
psql -d fotosnaps_db -f database/migrations/003_inventory_bujangan_food.sql
psql -d fotosnaps_db -f database/migrations/004_equipment_fotosnaps.sql
psql -d fotosnaps_db -f database/policies/rls_policies.sql
psql -d fotosnaps_db -f database/seeds/001_roles_and_tenants.sql

# 2) Backend — isi kredensial asli lalu jalankan
cd backend
cp .env.example .env   # isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, S3_*
npm install
npm run dev             # jalan di http://localhost:4000

# 3) Frontend — arahkan ke backend
cd frontend
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:4000
npm install
npm run dev
```

**Catatan penting soal seed password:** file `database/seeds/001_roles_and_tenants.sql` memakai `password_hash` placeholder (`$2b$10$replace_with_real_bcrypt_hash`), bukan hash asli. Sebelum bisa login, generate hash bcrypt sungguhan untuk password demo kamu:

```bash
node -e "console.log(require('bcrypt').hashSync('password_kamu', 10))"
```

Lalu `UPDATE users SET password_hash = '<hasil di atas>' WHERE email = 'admin@fotosnaps.id';` (ulangi untuk akun lain).

## 1. Apa yang sudah dikerjakan (contoh pola lengkap)

Sudah dimigrasikan penuh dari dummy → API real, sebagai **contoh pola** yang bisa kamu tiru:

| File | Perubahan |
|---|---|
| `src/lib/apiClient.ts` | Wrapper `fetch` yang otomatis menyisipkan header `Authorization` (JWT) + `X-Tenant-Id` di setiap request |
| `src/lib/AuthContext.tsx` | Login asli ke `POST /auth/login`, simpan sesi di `localStorage`, mapping role database (`CREW_EVENT`) ↔ role frontend (`crew_event`) |
| `src/main.tsx` | Dibungkus `<AuthProvider>` |
| `src/pages/LoginPage.tsx` | Form login memanggil `useAuth().login()` — sudah tidak ada kredensial hardcoded |
| `src/App.tsx` | State `role`/`loggedIn` lokal diganti `useAuth()` |
| `src/pages/admin/AdminAbsensi.tsx` | `dummyAbsensi` diganti `GET /attendance`, approve/reject memanggil `PATCH /attendance/:id` |
| `src/pages/crewEvent/CeAbsensi.tsx` | Riwayat absensi crew diganti `GET /attendance` |

## 2. Pola yang sama untuk halaman lain

Setiap halaman yang masih pakai `import { dummyX } from '../../data/dummy'` mengikuti pola berikut:

```tsx
import { useState, useEffect } from 'react';
import { api, ApiError } from '../../lib/apiClient';

interface MyRow { /* bentuk data yang dibutuhkan komponen */ }

function mapRow(apiRow: ApiResponseShape): MyRow {
  // ubah bentuk response backend -> bentuk yang dipakai JSX di bawah
}

export default function MyPage() {
  const [rows, setRows] = useState<MyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get<ApiResponseShape[]>('/endpoint-nya')
      .then(data => !cancelled && setRows(data.map(mapRow)))
      .catch(err => !cancelled && setError(err instanceof ApiError ? err.message : 'Gagal memuat data.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="p-6 text-slate-400 text-sm">Memuat…</div>;
  if (error) return <div className="p-6 text-red-600 text-sm">{error}</div>;

  // ...render rows seperti biasa, ganti nama field dummy lama dengan field hasil mapRow
}
```

## 3. Daftar halaman yang masih pakai dummy data + endpoint pengganti yang sudah tersedia

| File frontend | Dummy yang dipakai | Endpoint backend pengganti |
|---|---|---|
| `pages/admin/KelolaCrew.tsx` | `dummyCrew` | `GET/POST/PATCH /crew` |
| `pages/admin/KelolaEvent.tsx`, `DetailEvent.tsx` | `dummyEvents` | `GET/POST/PATCH /events`, `/event-locations`, `/event-assignments` |
| `pages/admin/AdminPayroll.tsx`, `shared/PayrollPage.tsx` | `dummyPayroll` | ⚠️ **Belum ada** endpoint payroll di backend — lihat Section 4 |
| `pages/admin/AuditLog.tsx` | `dummyAuditLog` | `GET /audit-logs` |
| `pages/admin/AdminDashboard.tsx` | `chartEventData`, `chartKehadiranData`, dll | `GET /dashboard/admin` (angka ringkasan) — chart historis perlu endpoint agregasi tambahan |
| `pages/crewEvent/CrewEventDashboard.tsx` | campuran | `GET /dashboard/crew?crewId=` |
| `pages/crewEvent/CeInventory.tsx`, `CeKertas.tsx` | data lokal di file masing-masing | belum ada tabel spesifik "kertas" di ERD — lihat Section 4 |
| `pages/crewStore/*` | `dummyAbsensi` (filtered), dll | sama seperti `CeAbsensi.tsx`, tinggal filter `jenis` |
| `pages/inventory/*` (8 halaman) | `dummyInventory` | `/inventory-items`, `/inventory-stocks`, `/stock-opname`, `/waste` |

## 4. Yang BELUM ada di backend/database (perlu ditambah dulu)

Beberapa fitur di UI mockup lebih detail daripada ERD Master saat ini:

- **Payroll** — ERD belum punya tabel `payroll` (hanya `attendance_logs`, `overtimes`). Perlu migration baru: `payrolls` (crew_id, period, gaji_pokok, total_lembur, total_potongan, status) sebelum `AdminPayroll.tsx`/`PayrollPage.tsx` bisa disambungkan.
- **Kertas/Operasional Event** (`CeKertas.tsx`, `CeOperasional.tsx`) — belum ada tabel di ERD. Perlu didiskusikan dengan tim apakah ini masuk `event_checklists` yang diperluas atau tabel baru.
- **Nama event/store di endpoint `/attendance`** — saat ini `attendance.controller.js` hanya join ke `crew`, belum ke `store_assignments`/`event_assignments` untuk menampilkan nama event/toko. Tambahkan join di `list()` bila field `event`/`jadwal` di UI perlu terisi asli (lihat komentar `TODO` di `AdminAbsensi.tsx` & `CeAbsensi.tsx`).
- **Approval telat/lembur terpisah** — skema `attendance_logs` saat ini tidak punya kolom approval khusus untuk telat/lembur (yang ada baru `attendance_corrections` untuk koreksi jam). Kalau mau workflow approve/reject seperti di mockup, tambah kolom `review_status` di `attendance_logs` atau bikin tabel baru `attendance_reviews`.
- **Foto sebagai URL langsung** — kolom `check_in_photo_url` menyimpan *object key* S3 (bukan URL yang bisa langsung dipakai `<img src>`), karena bucket private. Frontend perlu memanggil endpoint tambahan yang mengembalikan **signed URL** (`getSignedDownloadUrl` sudah ada di `backend/src/utils/signedUrl.js`, tinggal diekspos lewat route, mis. `GET /attendance/:id/photo-url`).

## 5. Setelah semua halaman termigrasi

Hapus `src/data/dummy.ts` dan jalankan build untuk memastikan tidak ada import yang tersisa:

```bash
grep -rn "from '.*data/dummy'" src/   # pastikan hasilnya kosong
rm src/data/dummy.ts
npm run build
```
