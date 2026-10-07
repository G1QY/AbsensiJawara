# Setup lokal dan deployment JAWARA

Panduan aktif, 5 Oktober 2026. Dasar: source baseline `805c40b`.

## Prasyarat

Gunakan Node.js 24 seperti CI, lalu `npm ci` pada backend dan frontend. Siapkan project Supabase uji, skema yang cocok, bucket private S3-compatible dan akun admin. Baca [panduan database](../supabase/README.md) sebelum menyiapkan database kosong.

Repository belum memiliki `.env.example` backend/frontend yang terlacak. Buat `.env` dari daftar berikut tanpa menimpa konfigurasi yang sudah ada. Environment asli tidak boleh masuk Git.

## Backend

`backend/.env` minimum untuk API dengan database uji:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
CORS_ORIGIN=http://localhost:8443,http://localhost:5173
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ISI_KEY_BACKEND
ENABLE_DEV_OTP=false
```

Ganti placeholder dengan konfigurasi sebenarnya. Service-role key hanya di server.

| Variabel tambahan | Kegunaan |
| --- | --- |
| `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Penyimpanan S3-compatible untuk foto/bukti/PDF. |
| `S3_BUCKET_NAME` | Bucket private; default `fotosnaps-private`. |
| `REDIS_URL` | Security store, rate limit dan koordinasi/cache geocoding. Wajib dalam production. |
| `RESEND_API_KEY`, `OTP_EMAIL_FROM` | OTP reset password; domain pengirim harus sesuai konfigurasi Resend. |
| `CREW_PASSWORD_VAULT_KEY` | Kunci 32 byte Base64 untuk salinan password terenkripsi. |
| `GOOGLE_CALENDAR_API_KEY` | Sinkronisasi libur Google Calendar. |
| `GOOGLE_HOLIDAY_CALENDAR_ID` | Override kalender; default aktif ditentukan `nationalHolidaySync.js`. |
| `GEOCODING_BASE_URL`, `GEOCODING_USER_AGENT` | Override geocoding; default kode memakai Nominatim. |
| `TRUST_PROXY_CIDRS` | Daftar proxy yang dipercaya sesuai jalur deployment. |

Tanpa storage, fitur foto belum siap meskipun `/health` merespons. Tanpa Resend, alur OTP belum siap. Jika vault gagal, akun/password masih dapat tersimpan tetapi salinan password tidak tersedia; respons membawa `passwordNotice`.

Dari root repository:

```powershell
cd backend
npm ci
npm run dev
```

Gunakan `npm start` untuk menjalankan tanpa watcher. `http://localhost:4000/health` hanya mengembalikan status proses, bukan seluruh dependency.

## Frontend

Buat `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

Nilai harus tanpa `/api` dan trailing slash. `VITE_ADMIN_WHATSAPP` dapat diisi untuk kontak bantuan. Jangan menaruh key server/S3/vault/Resend di variabel `VITE_*`.

Dari root repository, pada terminal kedua:

```powershell
cd frontend
npm ci
npm run dev
```

Port default Vite 8443. Untuk kamera/GPS dari ponsel, gunakan akses yang memenuhi persyaratan keamanan browser, backend yang dapat dijangkau perangkat dan CORS sesuai origin. `localhost` pada ponsel menunjuk ponsel itu sendiri.

## Admin awal

Seed SQL tidak membuat admin. Setelah skema/trigger dan role siap, jalankan `npm run bootstrap-admin` dari backend hanya bila admin belum ada. Baca [panduan akun](ADMIN_CREW_ACCOUNTS.md).

## Render

| Layanan | Root | Build | Start/output |
| --- | --- | --- | --- |
| API Node | `backend` | `npm ci --omit=dev` | `npm start` |
| Static UI | `frontend` | `npm ci --include=dev && npm run build` | `dist` |

Backend production membutuhkan `NODE_ENV=production`, `HOST=0.0.0.0`, port platform, `CORS_ORIGIN` berupa origin HTTPS frontend, Supabase dan `REDIS_URL`. `ENABLE_DEV_OTP=true` ditolak. Konfigurasikan health check `/health` dan proxy trust sesuai jalur sebenarnya.

Frontend memakai origin HTTPS API saat build. Perubahan `VITE_*` membutuhkan rebuild/deploy frontend; perubahan environment backend membutuhkan restart/deploy backend.

[render.yaml](../render.yaml) adalah template, bukan salinan konfigurasi production. Nama layanan masih `fotosnaps-demo-*`, Node blueprint 22.22.0, CI memakai 24. Selaraskan runtime setelah validasi. Key vault belum tercantum dalam blueprint dan dikelola terpisah bila fiturnya dipakai.

## Diagnosis

- Login: periksa respons API, Auth, `users.is_active` dan role pengguna.
- Gagal memuat: periksa origin API, CORS, sesi dan respons route; jangan langsung mengubah RLS.
- Refresh meminta login: perilaku sesi memori yang diterapkan.
- SQL/RPC tidak ditemukan: cocokkan migrasi dengan kode.
- OTP gagal: periksa pengirim, izin key, backend dan respons provider.
- Foto gagal tetapi health berhasil: periksa bucket, endpoint S3, credential dan izin objek.

Lanjutkan dengan [checklist rilis](RELEASE_CHECKLIST.md).
