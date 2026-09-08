# UI karyawan di browser handphone

- Navigasi bawah untuk Beranda, Absensi, Event/Riwayat, dan Menu. Menu lengkap tetap tersedia. Desktop memakai sidebar.
- Tinggi aplikasi mengikuti ruang browser (dynamic viewport) dan safe area. Navigasi bawah berada di luar area gulir sehingga tidak menutupi konten.
- Input mobile berukuran 16px. Tombol utama memiliki area sentuh minimal 44px. Judul halaman tetap terbaca; breadcrumb disembunyikan pada layar kecil.
- Workflow mobile memakai pilihan langkah bernama, menggantikan deretan 15 tombol kecil. Tombol utama menjelaskan bahwa langkah disimpan sebelum lanjut.
- Inventory mobile tampil sebagai kartu per barang. Dialog panjang memiliki batas tinggi dan area gulir.
- Kamera menyediakan pilihan depan/belakang, label tombol ambil foto, dan petunjuk singkat. Perangkat/browser menentukan ketersediaan kamera. Dokumentasi tetap menggunakan kamera langsung.
- Refresh absensi tidak menutup kamera atau mereset proses input selama konteks penugasan dan absensi tidak berubah. Perubahan penugasan tetap diterapkan.

## Validasi
TypeScript dan build lolos. 24 tes frontend lolos. Browser Chromium diuji dengan data fixture pada lebar 360, 390, 430 piksel dan desktop 1365 piksel. Navigasi, workflow, operasional, serta lebar konten diperiksa. Kamera depan/belakang diuji menggunakan perangkat kamera simulasi; refresh saat kamera terbuka juga diperiksa. Belum diuji pada perangkat Android/iPhone fisik atau Safari.

## Penerapan
Build ulang frontend dan publikasikan hasil build. Tidak ada migrasi SQL baru pada pembaruan UI ini. Panduan migrasi perpindahan tugas dari update sebelumnya tetap berlaku.
