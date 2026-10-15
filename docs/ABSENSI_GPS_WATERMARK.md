# GPS dan watermark foto absensi

Panduan aktif, 15 Oktober 2026.

## Crew terdaftar dan guest

Foto clock in/out pada menu Absensi serta langkah absensi Event Saya memuat waktu WIB, alamat di sekitar GPS, koordinat saat foto, estimasi akurasi perangkat, dan nama penugasan. Guest memakai informasi yang sama dengan desain foto guest. Lokasi penugasan tidak digunakan sebagai pengganti alamat GPS.

GPS dibaca kembali ketika tombol foto ditekan. Frame kamera diambil sebelum menunggu pencarian alamat. Titik yang dicetak pada foto juga dikirim sebagai koordinat absensi; koordinat objek dari penyedia alamat tidak mengganti GPS perangkat. Izin GPS yang ditolak atau koordinat tidak valid menghentikan pengambilan foto absensi. Foto dokumentasi peralatan tetap dapat diambil tanpa GPS.

Contoh: crew ditugaskan di Kantor Bandung dan berada di Jakarta. Jika Super Admin mengaktifkan **Semua lokasi — GPS tetap dicatat**, crew dapat absen sesuai jadwal. Foto mencetak alamat/GPS Jakarta dan baris **Penugasan: Kantor Bandung**. Mode radius tetap memeriksa jarak dari penugasan. Fitur ini tidak melacak crew terus-menerus.

Desktop dan ponsel memakai komponen kamera yang sama. Pada ponsel, **Kelola Crew** menampilkan kartu dengan foto, penempatan, mode lokasi, dan **Detail → Edit** untuk mengubah pengaturan. Teks watermark dibungkus agar muat pada foto portrait maupun landscape.

## Saat nama jalan belum tersedia

GPS dan nama alamat berasal dari dua proses berbeda. GPS perangkat dapat berhasil saat layanan pencarian alamat sedang tidak merespons, dibatasi, atau belum memiliki data untuk titik tersebut. Screenshot dengan koordinat saja tidak dapat memastikan penyebab mana yang terjadi.

Backend meminta nama jalan (zoom 17); bila hasil kosong atau penyedia menjawab 404, backend mencoba nama wilayah (zoom 14). Kegagalan jaringan/429 tidak diulang otomatis. Keduanya tetap memakai cache dan pembatas bersama Redis. Browser menghubungi backend, bukan penyedia langsung.

Guest membedakan pesan alamat tidak tercantum, layanan belum dapat dihubungi, dan pencarian sedang ramai. **Cari alamat GPS lagi** mencoba ulang tanpa memakai hasil kosong cache browser; cache backend hasil kosong tetap berlaku 60 detik. Jika alamat gagal, foto tetap memuat koordinat dan akurasi dengan tulisan **Alamat belum tersedia; lihat koordinat GPS**. Nama jalan tidak ditebak dari penugasan. Alamat merupakan hasil pemetaan terdekat, bukan jaminan nomor bangunan.

## Penerapan dan pemeriksaan

- Deploy backend lebih dahulu, lalu build/deploy frontend. Crew menggunakan endpoint baru `POST /api/attendance/location` dengan login dan pembatas role absensi pribadi. Guest memakai `POST /api/guest-location/reverse`. Pencarian direktori admin tetap terpisah.
- Tidak ada migrasi database baru untuk watermark ini. Pengaturan Kantor/Semua lokasi membutuhkan migrasi `20261008043901_crew_office_flexible_attendance.sql` bila belum dipasang sebelumnya.
- Gunakan HTTPS, izinkan kamera serta lokasi presisi pada browser ponsel, lalu muat ulang aplikasi setelah deployment. Foto yang sudah tersimpan tidak diubah.
- Bila alamat gagal, lihat status respons endpoint: 429 berarti pembatasan; 503 berarti layanan/koordinasi belum tersedia. Pastikan koneksi Redis production sehat dan backend dapat mengakses penyedia. `GEOCODING_BASE_URL` dapat menunjuk ke penyedia HTTPS kompatibel Nominatim JSONv2; `GEOCODING_USER_AGENT` mengidentifikasi aplikasi. Hindari mencatat koordinat/personel dalam log diagnosis umum.
- Uji regresi: `backend/tests/geocoding.test.cjs`, `frontend/tests/attendance-watermark.test.cjs`, `frontend/tests/crew-location-browser.cjs`, dan `frontend/tests/guest-submission-browser.cjs`. Browser tests menggunakan data simulasi, bukan akun/GPS produksi.
