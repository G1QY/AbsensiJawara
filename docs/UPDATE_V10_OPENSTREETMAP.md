# Pembaruan V10: OpenStreetMap dan alamat GPS guest

Dasar: main 8aefb696806368a215763eede6b1193504930063 (PR #5).

## Perubahan

- Form Store, Kantor, dan Event memakai Leaflet + OpenStreetMap. Peta langsung tampil, tanpa key Google Maps/MapTiler.
- Satu kolom alamat. Klik Cari atau tekan Enter, kemudian pilih hasil. Tidak ada request autocomplete saat mengetik.
- Klik peta/selesai geser pin mencari alamat titik pilihan. Koordinat pin tetap dipertahankan, walaupun penyedia mengembalikan koordinat objek di dekatnya.
- Jika alamat diketik ulang, koordinat dibatalkan sampai admin memilih hasil atau mengonfirmasi alamat untuk pin yang ditampilkan. Respons lama tidak menimpa input baru.
- Guest melihat peta posisi perangkat, lingkaran akurasi, dan alamat dari GPS. Pin guest tidak bisa dipindahkan.
- Foto mengambil GPS baru, mencari nama jalan, lalu mencetak alamat, koordinat, akurasi, waktu, penugasan, dan atribusi OSM. Alamat store tidak digunakan sebagai pengganti lokasi GPS.
- Jika layanan alamat gagal/tidak memiliki data, foto menampilkan "Nama jalan belum tersedia" bersama GPS. Absensi tetap dapat dikirim. Peta yang gagal dimuat juga tidak menghalangi absensi.
- Saat kirim, GPS diperiksa lagi. Jika jarak dari lokasi foto melebihi maksimum 100 meter atau jumlah estimasi akurasi kedua pengukuran, pengguna diminta mengambil ulang foto. Koordinat yang dikirim sesuai dengan watermark foto.
- Perbaikan entri Completed ganda pada Badge.tsx yang menyebabkan TS1117.
- Bahasa Indonesia/Inggris dan bentuk mobile tetap dipertahankan.

## Pemasangan

Frontend DAN backend harus diperbarui. Tidak ada SQL/migrasi baru pada V10. Migrasi versi sebelumnya tetap diperlukan bila belum dipasang.

1. Terapkan commit/patch atau salin berkas pembaruan sesuai CARA_PASANG.txt.
2. Hentikan proses frontend dan backend lokal dengan Ctrl+C sebelum instalasi/build.
3. Jalankan perintah PowerShell satu per satu:

```powershell
cd D:\AbsensiJawara\backend
npm ci --include=dev
npm test
cd ..\frontend
npm ci --include=dev
npx tsc --noEmit
npm run build
```

Jangan hapus package-lock.json. Jika node_modules terkunci (EPERM), pastikan semua proses dev telah berhenti sebelum mencoba lagi.

4. Jalankan ulang backend dan frontend lokal. Pastikan VITE_API_BASE_URL menunjuk ke backend yang baru. Nilainya origin backend, tanpa /api dan tanpa garis miring di akhir.
5. Untuk Render, deploy backend, kemudian build/deploy frontend. render.yaml tidak lagi meminta VITE_GOOGLE_MAPS_API_KEY atau VITE_MAPTILER_API_KEY. Google Calendar API tetap terpisah dan tidak berubah.
6. Gunakan HTTPS agar kamera dan GPS berfungsi di HP. localhost hanya untuk pengujian pada perangkat yang sama.

## Layanan alamat dan batas operasional

Default backend: Nominatim, https://nominatim.openstreetmap.org. Browser hanya menghubungi backend. Backend tidak mengirim nama crew, nomor HP, foto, atau isi absensi ke layanan alamat. Yang dikirim hanya teks pencarian admin atau koordinat untuk reverse geocoding.

Aturan resmi: https://operations.osmfoundation.org/policies/nominatim/

Server publik Nominatim membatasi SELURUH aplikasi maksimum 1 request/detik, bukan per pengguna. Penggunaan berat dan autocomplete dilarang. Implementasi mengunci akses provider bersama, memberi jarak sekurang-kurangnya 1,1 detik setelah request selesai, menyimpan cache 24 jam (hasil kosong 60 detik), dan tidak mencoba ulang otomatis. Antrean dibatasi 4,5 detik. Respons 403/429 menghentikan permintaan baru selama 60 detik. GPS/absensi tetap berjalan jika pencarian gagal.

Untuk production, REDIS_URL yang sudah diwajibkan proyek harus menunjuk ke Redis yang SAMA bagi seluruh replika backend. Cache, kunci provider, dan cooldown dibagikan di sana. Jika Redis terputus, layanan alamat tidak melewati pembatas. Mode development tanpa Redis hanya untuk satu proses backend.

Server publik tidak dirancang untuk lonjakan absensi 1.000 karyawan. Sebelum penggunaan sebesar itu, gunakan instance Nominatim sendiri atau layanan dengan kapasitas dan API Nominatim yang sesuai. Ubah GEOCODING_BASE_URL pada backend dan restart. Nilai harus URL HTTPS kompatibel search/reverse JSONv2, tanpa query atau kredensial. Pergantian provider tidak memerlukan perubahan frontend. Set GEOCODING_USER_AGENT dengan nama aplikasi dan URL/email kontak operator bila diperlukan. Default sudah mengidentifikasi repo Jawara.

Pratinjau peta memakai tile OSM standar dengan atribusi, Referer browser, dan cache HTTP. Tidak ada unduhan offline/prefetch wilayah. Kebijakan: https://operations.osmfoundation.org/policies/tiles/

Nama jalan mengikuti ketersediaan data OSM dan hasil reverse geocoding terdekat. Koordinat GPS asli tetap menjadi bukti posisi; hasil geocoder tidak mengganti koordinat tersebut.

## Verifikasi

- TypeScript dan build frontend lulus.
- Suite backend: 53 lulus, 5 tes database dilewati karena runtime database lokal tidak dipasang untuk perubahan ini. Tidak ada perubahan skema SQL.
- Suite frontend: 38 lulus.
- Dua alur browser lulus dengan Leaflet asli serta fixture HTTP, tile, kamera, dan GPS: admin cari/pilih/simpan, pin/manual, request terlambat/429, ganti bahasa, mobile; guest watermark nama jalan, alamat gagal, perpindahan GPS, kirim gagal, kirim ulang, dan popup setelah server menerima.
- Tes baru backend memeriksa validasi, deduplikasi, cache, jarak request, lock bersama antarreplika, cooldown, dan pembatasan role. Redis diuji dengan adapter memori, bukan server production.
- Akses langsung ke layanan publik OSM/Nominatim tidak berhasil dari lingkungan pengerjaan (koneksi timeout). Perlu pemeriksaan layanan live setelah deployment. Tidak ada klaim uji langsung di HP fisik.
- Tidak ada perubahan database production atau deployment otomatis.
