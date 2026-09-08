 # Setup Supabase — Lokal (Development) → Cloud (Produksi)

## Kenapa dua tahap?

- **Lokal (Docker, via `supabase start`)** — buat development sehari-hari di laptop kamu/tim. Gratis, tidak butuh internet setelah image ke-download, data hanya ada di komputer kamu.
- **Cloud (supabase.com)** — buat pemakaian **perusahaan jangka panjang** yang kamu sebutkan: data tersimpan di server Supabase (bisa diakses dari mana saja, ada backup otomatis, bisa diakses banyak orang/device sekaligus — Store & Event crew yang absen dari HP masing-masing).

Cara kerjanya identik (schema SQL yang sama, kode backend yang sama) — bedanya cuma `SUPABASE_URL` & key di `.env` menunjuk ke lokal atau ke cloud. Jadi alur belajar di lokal dulu itu sudah benar.

## Tahap 1 — Lokal (ikuti langkah di chat sebelumnya)

Ringkasan: `docker` → `supabase init` → `supabase start` → jalankan `run_all.sql` di Studio → isi `backend/.env` dengan credentials lokal.

## Tahap 2 — Pindah ke Cloud saat siap dipakai sungguhan

1. Daftar di [supabase.com](https://supabase.com), buat **New Project** (pilih region terdekat, mis. Singapore untuk latensi rendah dari Indonesia).
2. Simpan **Database Password** yang diminta saat create project — ini beda dari password akun user aplikasi kamu.
3. Di dashboard project baru: buka **SQL Editor** → jalankan `database/run_all.sql` yang sama persis seperti di lokal.
4. Buka **Storage** → buat bucket `fotosnaps-private` (private, sama seperti di lokal).
5. Buka **Project Settings → API** → salin `Project URL` dan `service_role` key → ini yang dipakai untuk `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` di server produksi (bukan lagi `localhost`).
6. Buka **Project Settings → Storage → S3 Access Keys** → generate key baru untuk `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` produksi.
7. Deploy `backend/` ke hosting (mis. Railway, Render, VPS) dengan `.env` produksi berisi credentials cloud di atas — **jangan pernah** commit file `.env` asli ke Git (sudah ada di `.gitignore`).
8. Deploy `frontend/` (mis. Vercel/Netlify) dengan `VITE_API_BASE_URL` menunjuk ke URL backend produksi.

## Soal "banyak data" jangka panjang

Supabase Cloud tier gratis punya batas (500MB database, project di-pause otomatis kalau tidak ada aktivitas 7 hari). Untuk pemakaian perusahaan yang serius dan datanya terus bertambah (absensi harian banyak crew, foto, dst), rencanakan upgrade ke **tier Pro** (mulai ~$25/bulan) sebelum go-live — supaya tidak kena limit atau project ter-pause saat sedang dipakai operasional.
