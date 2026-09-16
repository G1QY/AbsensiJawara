# Pengaturan lokasi hemat biaya (v6, diperbarui V9)

## Pasang

Paket kumulatif ini dipasang di atas proyek AbsensiJawara, bukan proyek lengkap.
Salin folder/file paket ke root proyek, tinjau diff, commit, lalu deploy frontend dan backend.
Tidak ada migrasi SQL baru untuk v6. Jika belum memasang v4, jalankan SQL yang dijelaskan dalam CARA_PASANG.txt terlebih dahulu.
Jangan timpa .env aktif dengan contoh; tambahkan hanya variabel yang dibutuhkan.

## Environment frontend (Render static site)

VITE_GOOGLE_MAPS_API_KEY: key Google yang sudah dipakai untuk admin.
Aktifkan Maps JavaScript API, Geocoding API, dan Places API (New) untuk fallback pencarian nama usaha. Batasi key ke API tersebut dan domain frontend.
Peta Google hanya dimuat sesudah tombol "Buka peta" atau "Cari" ditekan.
Cari alamat hanya mengirim permintaan setelah tombol Cari atau Enter. Tidak ada autocomplete per karakter.
Geser/klik pin dan "Gunakan lokasi perangkat" mengubah koordinat tanpa geocoding.
"Cari alamat titik ini" adalah permintaan reverse geocoding eksplisit, hanya di admin.
Periksa/isi alamat penugasan sebelum menyimpan titik yang dipindahkan.
Tanpa key Google, lokasi tersimpan tetap dapat dibaca/disimpan; admin dapat memakai GPS perangkat dan mengisi alamat.

VITE_MAPTILER_API_KEY: opsional, key MapTiler untuk pratinjau peta guest.
Gunakan paket yang mengizinkan penggunaan produksi perusahaan dan batasi key ke domain frontend.
Paket kode tidak membuat akun, membeli paket, atau mengaktifkan penagihan.
Kosongkan key jika belum ingin memakai pratinjau peta. GPS dan tautan lokasi tetap tersedia.
Render Blueprint menyertakan default kosong. Pada layanan yang sudah berjalan, isi melalui Environment frontend.
Key VITE_* memang dikirim ke browser; gunakan key publik dengan pembatasan domain, bukan token administrasi penyedia.
Setelah mengubah key, build/deploy ulang frontend. Restart backend saja tidak mengubah hasil build Vite.
Frontend: npm ci --include=dev, lalu npm run build. Publish Directory: dist.

## Penggunaan MapTiler

Pratinjau guest memakai Leaflet dengan raster tiles streets-v2, ukuran tile 512 dan zoomOffset -1.
Tile dimuat hanya setelah tombol "Tampilkan peta" ditekan; marker tidak dapat digeser dan peta tidak menerima navigasi zoom/pan pengguna.
Atribusi MapTiler dan OpenStreetMap tetap tampil.
Satu pembukaan peta dapat meminta beberapa tile. Jangan menyamakan jumlah absensi, map loads, session, dan tile requests.
Pembaruan koordinat pada peta yang terbuka menggunakan instance peta yang sama.
Kegagalan tile tidak memblokir pengiriman absensi. Tidak ada fallback otomatis ke server publik OSM/Nominatim.
Peta perangkat tidak mempunyai callback untuk menulis koordinat absensi.

## Data absensi dan laporan

Guest tidak meminta alamat jalan otomatis. Sejak V9, foto mencetak alamat penugasan yang tersimpan di store/kantor/event, bersama koordinat GPS perangkat. Alamat tersebut ditandai sebagai alamat penugasan, dan data lama tetap dipertahankan.
Nama kantor/store/event tetap merupakan lokasi penugasan, bukan klaim alamat aktual GPS.
Guest mengambil GPS lagi saat kirim. Penolakan izin/GPS gagal menghentikan kirim tanpa membuat lokasi pengganti.
Pengiriman ulang yang belum dikonfirmasi server tetap memakai submissionKey yang sama untuk isian/foto yang sama, meski pengukuran GPS baru sedikit bergeser.
Validasi radius backend untuk akun terdaftar dan tinjauan admin untuk guest tetap mengikuti aturan sebelumnya.
Crew terdaftar memang sudah menggunakan GPS dan Haversine tanpa API peta berbayar.
WhatsApp guest memuat koordinat, akurasi, lokasi penugasan, serta tautan peta.
Detail/tinjauan absensi admin dan rekap Excel/PDF memuat GPS masuk/pulang secara terpisah dari data tersimpan.
Akurasi yang tidak pernah disimpan pada data crew terdaftar tidak ditebak; ditampilkan tidak tercatat/kosong pada ekspor.
Ekspor tidak memanggil Maps/Geocoding.

## Kalender backend

GOOGLE_CALENDAR_API_KEY dan GOOGLE_HOLIDAY_CALENDAR_ID tetap seperti sebelumnya.
Cache database yang sudah ada berlaku 30 hari per tahun, bukan satu request per karyawan.
Permintaan bersamaan untuk tahun yang sama digabung dalam satu proses backend, termasuk refresh paksa saat refresh lain sedang berjalan.
Jika penyedia gagal, retry otomatis ditunda satu jam; data tersimpan/fallback resmi digunakan sesuai mekanisme sebelumnya.
Refresh paksa admin tetap tersedia. Ini penggabungan per proses, bukan distributed lock lintas semua instance.
Satu sinkronisasi dapat berisi beberapa request jika respons Google berhalaman.

## Kendali biaya pada akun penyedia

Atur quota API Google sesuai kebutuhan admin dan aktifkan budget alert. Budget alert sendiri bukan penghenti tagihan.
Atur spending limit penyedia tile jika tersedia. Saat batas tercapai, peta dapat gagal tampil, tetapi absensi tidak bergantung padanya.
Pantau penggunaan per API/SKU sesudah deployment, terutama saat jam masuk/pulang.
Tidak ada jaminan biaya nol atau persentase penghematan tertentu dari paket kode ini.
Biaya database, backend, foto dan bandwidth aplikasi terpisah dari API peta.

## Verifikasi

12 pengujian frontend lulus: GPS segar, izin ditolak, koordinat nol/kosong, pemetaan GPS masuk/pulang, perusahaan/jabatan, XLSX, PDF, dan pemilih lokasi admin.
9 pengujian backend kalender lulus, termasuk 100 permintaan serentak menjadi satu panggilan provider dalam satu proses.
Build frontend dan TypeScript lulus. Pemeriksaan memakai data/provider tiruan, bukan akun Google/MapTiler live.
Catatan di atas mencatat pengujian v6. Pengujian browser terbaru dan batasannya dijelaskan dalam UPDATE_V9.md.

## Referensi konfigurasi

https://docs.maptiler.com/leaflet/
https://developers.google.com/maps/billing-and-pricing/pricing
https://developers.google.com/maps/documentation/geocoding/usage-and-billing
https://developers.google.com/workspace/calendar/api/guides/quota
