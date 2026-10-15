# Panduan UI JAWARA

Panduan aktif, 5 Oktober 2026. Menggambarkan source baseline `805c40b`, menggantikan palet Indigo dan ketentuan bentuk dari mockup awal.

## Sumber tampilan

- [index.css](../frontend/src/index.css): Tailwind CSS 4, token, tema, class bersama dan responsivitas.
- [App.tsx](../frontend/src/App.tsx): shell dan workspace role.
- [Komponen UI](../frontend/src/components/ui): modal, toast, badge, avatar, input, bahasa dan tema.
- [Layout](../frontend/src/components/layout): sidebar, topbar dan navigasi.

UI memakai utility Tailwind dan class seperti `ui-card`, `ui-input`, `ui-button`. Gunakan token/class yang ada untuk perubahan baru. Token `--app-*` dan override setelah `@theme` memengaruhi hasil akhir; jangan hanya membaca deklarasi warna awal file.

## Tema dan warna

| Token aktif | Terang | Gelap |
| --- | --- | --- |
| `--app-bg` | `#f1f5fb` | `#050c1a` |
| `--app-surface` | `#ffffff` | `#0d1b30` |
| `--app-raised` | `#f5f8ff` | `#132740` |
| `--app-text` | `#0b1730` | `#ffffff` |
| `--app-muted` | `#465873` | `#c4d6ee` |
| `--app-border` | `#c5d2e5` | `#405d80` |
| `--app-action` | `#1554df` | `#1554df` |
| `--app-focus` | `#1554df` | `#85baff` |

Tema dipasang melalui `data-theme`. Warna status disertai teks/ikon. Sidebar aktif memakai latar action dan teks putih; aturan garis Indigo dari mockup bukan baseline aktif.

## Tipografi dan bentuk

Font utama Inter; angka/kode tertentu memakai JetBrains Mono. Label tidak harus selalu uppercase. Ikuti komponen dan konteks bahasa.

Radius tidak seragam 4px: token dasar 6/10/14/20px, input bersama 10px, kartu bersama 18px. Komponen lain memakai utility sesuai kebutuhan. Avatar dapat bulat; jangan menerapkan aturan semua foto harus persegi dari mockup lama.

## Layout dan interaksi

Shell memakai tinggi `100dvh`, sidebar, topbar dan konten yang dapat bergulir. Workspace ditentukan role, dengan penjagaan agar halaman role lain tidak sempat dirender ketika akun berubah. Penyembunyian menu bukan satu-satunya kontrol keamanan.

Mobile membuka sidebar melalui tombol menu. Keberadaan komponen navigasi lain dalam repo tidak berarti semuanya dirender App; periksa pohon komponen sebelum mengubah navigasi.

Form memiliki label, validasi serta keadaan simpan yang jelas. Sukses berarti server telah menerima operasi. Gunakan mekanisme modal/fokus/penutupan yang tersedia. Konfirmasi mengikuti alur bisnis, misalnya finalisasi payroll.

## Mobile, bahasa dan aksesibilitas

- Aturan mobile utama memakai breakpoint 767px; beberapa tabel/kartu berubah pada 639px.
- Kelola Crew memakai kartu di bawah 640px agar foto, penempatan, mode lokasi, dan tombol Detail dapat dibaca tanpa menggeser tabel.
- Selector mobile menerapkan target sentuh sekitar 44px; input workspace karyawan memakai font 16px/min-height 48px.
- Periksa overflow, keyboard virtual, safe area, tabel dan dialog panjang.
- Pertahankan focus indicator serta label/role untuk keyboard dan pembaca layar.
- Hormati aturan `prefers-reduced-motion` yang tersedia.
- Teks baru mengikuti `i18n.ts` dan katalog bahasa; periksa Indonesia/Inggris.
- Tema/bahasa adalah preferensi, terpisah dari sesi Auth.

## Bukti foto

Kamera/lokasi dan dialog absensi membedakan izin ditolak, lokasi gagal, foto belum tersedia dan pengiriman gagal. Jangan menampilkan “Face Matched” tanpa implementasi biometrik; pengambilan foto bukan bukti adanya verifikasi wajah otomatis.

Foto absensi baru mencetak alamat GPS aktual, koordinat/akurasi, waktu WIB, dan penugasan dalam baris terpisah. Frame dan GPS diambil sebelum pencarian alamat; kegagalan alamat tetap menampilkan koordinat. Komponen kamera absensi digunakan bersama pada desktop/mobile; lihat [panduan watermark](ABSENSI_GPS_WATERMARK.md).

## Verifikasi UI

Periksa desktop/mobile, tema terang/gelap, kedua bahasa, keyboard, loading/kosong/gagal dan batas role. Jalankan TypeScript, build dan suite browser terkait sesuai [checklist rilis](RELEASE_CHECKLIST.md). Panduan ini bukan klaim sertifikasi aksesibilitas seluruh layar.
