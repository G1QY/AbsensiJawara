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
| `20261005160149` | Payroll, libur dan izin jadwal. |
| `20261006100934` | Aturan payroll tahunan dan kalender pembayaran. |
| `20261008043901` | Jenis penugasan Kantor, mode absensi semua lokasi, snapshot mode dan jarak GPS antarkota. |
| `20261023150118` | Istirahat per shift, foto/GPS awal dan akhir, serta pengajuan/tinjauan izin dan sakit. |

Pada pemeriksaan 5 Oktober, sembilan versi pertama tercatat di database yang diperiksa. Versi payroll `20260925222422` tidak tercatat, tetapi tabel/fungsinya sudah ada. Ini temuan bertanggal, bukan instruksi menjalankan ulang migrasi. Bandingkan definisi objek dan riwayat terlebih dahulu; lihat [laporan](../docs/PROJECT_HANDOVER_20261005.md).

Untuk perubahan lokasi absensi 8 Oktober, terapkan `20261008043901_crew_office_flexible_attendance.sql` sebelum menjalankan backend baru. Migrasi menambahkan field crew dan absensi, memperbesar kolom jarak, serta memperbarui RPC `manage_crew`; lokasi kantor existing dikenali dari penugasan aktif. Tidak diperlukan perubahan bucket atau pemindahan foto. Pengujian migrasi lokal tersedia di `backend/tests/crew-location-policy-sql.test.cjs`; hasil lokal tidak membuktikan migrasi sudah diterapkan ke production.

## Database existing

Untuk pembaruan istirahat/izin, migrasi `20261023150118_shift_breaks_permissions.sql` harus tersedia sebelum backend baru digunakan. Kolom lama dan bukti absensi dipertahankan; jadwal existing belum memiliki istirahat sampai diatur admin. Panduan alur dan pemeriksaan tersedia di [Istirahat dan izin/sakit](../docs/ISTIRAHAT_IZIN_JADWAL.md).

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
