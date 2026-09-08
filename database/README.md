# database/ — Reserved untuk Bujangan Food (belum dikerjakan)

Folder ini SENGAJA dikosongkan. Migration FotoSnaps sudah pindah ke
`supabase/migrations/` (lihat `supabase/README.md`), mengikuti arsitektur
final: **1 database per perusahaan**, bukan lagi 1 database shared.

Sesuai REPORT_PROGRESS terbaru: **jangan kerjakan Bujangan Food dulu**
sampai database FotoSnaps stabil (migration, RLS, backend, auth, crew,
attendance semua sudah jalan). Struktur tabel Bujangan Food nanti akan
memakai pola yang sama seperti FotoSnaps (`users, roles, user_roles, crew,
stores, events, attendance...`) ditambah modul khusus:

```
inventory_items
inventory_stocks
stock_opname_logs
waste_logs
```

Kode backend untuk modul-modul itu sudah ada duluan di
`backend/src/modules/inventory/` (dibuat sebelum keputusan pisah database),
tapi **belum dipasang** ke `app.js` — lihat komentar di sana. Modul itu
perlu instance backend + Supabase terpisah yang menunjuk ke database
Bujangan Food, bukan database FotoSnaps yang sekarang jalan.
