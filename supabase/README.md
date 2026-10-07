# Database Supabase JAWARA

Panduan aktif, 5 Oktober 2026. Folder ini adalah sumber SQL aplikasi saat ini. Database dipisah per perusahaan, tanpa tenants/user_tenants atau tenant_id sebagai pemisah akses.

## Identitas dan skema

`auth.users` dikelola Auth; `public.users` menyimpan profil; `roles`/`user_roles` menentukan role; `crew` menyimpan personel. Relasi domain dirangkum di [PRD aktif](../docs/PRD_ERD_CURRENT.md).

`seed.sql` hanya mengisi sebagian role baku; role staff ditambahkan migrasi berikutnya. Seed tidak membuat admin. Script bootstrap berada di `backend/scripts/bootstrap-admin.js`, dijalankan sebagai `npm run bootstrap-admin` dari backend setelah schema/trigger dan role siap.

## Kondisi migrasi

Folder `migrations/` berisi SQL dasar tanpa timestamp, migrasi bertimestamp dan beberapa pasangan duplikat. Berkas dasar nyata mencakup `foundation.sql`, `workforce.sql`, `attendance.sql`, `equipment.sql`, `audit_rls.sql`. Nama bernomor lama dan `database/run_all.sql` bukan berkas setup aktif.

**Jangan menganggap `supabase db reset` atau menjalankan semua SQL secara alfabetis akan menghasilkan database yang benar.** Baseline database kosong belum dinyatakan dapat direproduksi otomatis.

| Versi bertimestamp | Perubahan |
| --- | --- |
| `20260901021500` | Crew, overtime approval, notifications. |
| `20260901090000` | Secure event workflows. |
| `20260902040000` | Unique attendance per schedule. |
| `20260902050000` | Kalender nasional dan rentang jadwal. |
| `20260914101401` | Riwayat lokasi dan workflow review. |
| `20260918102008` | Head Store, akun dan attendance. |
| `20260924073548` | Vault password dan profil/role. |
| `20260925033622` | Staff, review dan dashboard. |
| `20260925113935` | Work shifts. |
| `20260925222422` | Persisted payroll. |

Pada pemeriksaan 5 Oktober, sembilan versi pertama tercatat di database yang diperiksa. Versi payroll terakhir tidak tercatat, tetapi tabel/fungsinya sudah ada. Ini temuan bertanggal, bukan instruksi menjalankan ulang migrasi. Bandingkan definisi objek dan riwayat terlebih dahulu; lihat [laporan](../docs/PROJECT_HANDOVER_20261005.md).

## Database existing

1. Pastikan project dan commit tujuan; baca riwayat migrasi/schema aktual.
2. Cocokkan tabel, kolom, constraint, indeks, trigger, fungsi dan grant yang diperlukan.
3. Bedakan objek belum ada dari perubahan manual yang belum tercatat.
4. Uji pada database terisolasi dan siapkan pemulihan sebelum perubahan production.
5. Terapkan perubahan yang telah ditinjau; verifikasi hasil dan catat migrasinya.

## Database baru

Susun baseline SQL dasar beserta patch lanjutan, lalu verifikasi dependensinya pada environment terisolasi. Tes SQL repo menunjukkan urutan skenario tertentu, bukan installer seluruh aplikasi. Sampai baseline lengkap diuji, satu perintah reset bukan quick start yang dapat diandalkan.

## Akses data

Backend memakai service-role, sehingga middleware/RPC tetap memeriksa aktor dan scope. Payroll serta vault private membatasi akses langsung client; RLS tanpa policy pada tabel service-only tidak otomatis memerlukan policy publik baru.

Bukti berada pada bucket private dan diakses melalui signed URL. Key server/storage/vault tidak dimasukkan frontend. Lihat [setup Supabase](../docs/SUPABASE_SETUP.md).
