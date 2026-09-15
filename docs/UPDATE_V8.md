# Pembaruan crew, lokasi, dan workflow event

Pembaruan ini dibuat dari GitHub `main` commit `3ab1bb15707617d3aa4023ed6f7180f002fa07d8`, lalu dibandingkan dengan arsip v3–v7. Perubahan terbaru di main dipertahankan.

## Perbandingan versi sebelumnya

| Versi | Hasil pemeriksaan dan tindakan |
| --- | --- |
| v3 — perusahaan, jabatan, impor CSV | Sudah ada. Form, impor, profil, dan direktori dipertahankan. |
| v4 — penyelarasan semua akun | Sudah ada. Identitas pekerjaan dipindahkan ke bawah sambutan dashboard crew event/store; tidak lagi tampil di semua halaman. |
| v5 — Excel dan PDF | Sudah ada. Ekspor hasil event memakai komponen bersama, konteks perusahaan/cabang, dan perhitungan omzet yang sama. Kota/cabang ditambahkan pada tampilan serta ekspor direktori dan crew terkait. |
| v6 — penghematan API lokasi | Sudah ada dan dipertahankan. Absensi memakai GPS perangkat, tanpa geocoding pada setiap kirim. Pencarian alamat admin mengikuti konfigurasi yang ada. |
| v7 — animasi pop up absensi | Komponen animasi belum lengkap di main. Dialog dan CSS dipasang serta dihubungkan ke hasil sukses dari server; form terbaru tetap dipertahankan. |

Semua berkas sumber pada paket v3–v7 memiliki padanan dalam repo ini setelah penggabungan; migrasi dari folder `sql` paket lama dipetakan ke `supabase/migrations`. Berkas panduan versi lama dan keluaran pengujian tidak disalin sebagai kode aplikasi.

## Perilaku baru

- Identitas perusahaan, jabatan, dan cabang crew hanya ada di dashboard, setelah kartu selamat datang.
- Halaman Inventory dan Operasional crew hanya menampilkan hasil. Workflow yang masih berjalan tetap dapat diisi; setelah selesai, berakhir, atau event dibatalkan, tombol menjadi **Tinjau Workflow**. Backend menolak perubahan dan unggahan baru pada kondisi tersebut. Bukti foto tetap dapat dilihat.
- Workflow selesai dikunci di database. Penyimpanan langkah terakhir, perubahan status event/penugasan, dan pencatatan audit berjalan dalam transaksi yang sama.
- Detail event admin dan crew memakai tampilan Inventory/Operasional yang sama. Audit event menampilkan nama pelaku dan crew/data terkait; nama yang tidak tersedia tidak ditebak.
- Struktur lokasi menjadi **kota → cabang/tempat → store atau kantor**. Contoh: kota Jakarta, cabang Blok M, dua store bernama Roll Film dan Peeps. Kode internal lama tetap dipertahankan untuk kestabilan referensi dan tidak perlu diisi pengguna.
- Admin boleh memperbaiki cabang store tanpa menghapus riwayat. Lokasi dengan penugasan aktif harus diakhiri penugasannya dahulu. Bila tinggal riwayat guest, penugasan berakhir, atau jadwal lama, tindakan Hapus mengarsipkan lokasi dan menyimpan riwayatnya. Lokasi tanpa referensi dihapus permanen. Arsip dapat dipulihkan dengan status Nonaktif.
- Tombol **Hapus** tersedia di Manajemen Absensi untuk catatan guest dan crew terdaftar. Konfirmasi meminta alasan. Penghapusan beserta catatan audit, koreksi, dan lembur terkait dilakukan dalam satu transaksi. Penghapusan ini tidak menghapus berkas foto dari penyimpanan.
- Setelah server menerima absensi guest, dialog sukses muncul di tengah layar dengan animasi, ringkasan, tombol WhatsApp, dan tombol Tutup. Pengiriman gagal tetap menyimpan foto/catatan untuk dicoba ulang. WhatsApp hanya terbuka saat tombolnya diklik.

## Urutan pemasangan

1. Cadangkan database sesuai prosedur proyek. Terapkan **hanya migrasi baru** `supabase/migrations/20260914101401_location_history_and_workflow_review.sql` setelah seluruh migrasi proyek yang sudah digunakan. Bisa melalui alur Supabase CLI proyek atau SQL Editor pada proyek yang benar. Jangan reset database atau menjalankan ulang skrip awal untuk memasang pembaruan ini.
2. Setelah migrasi berhasil, pasang backend dan frontend dari branch pembaruan yang sama. Kedua sisi memakai kolom `city_name`, `deleted_at`, dan fungsi SQL baru sehingga harus diperbarui bersama.
3. Di Kelola Cabang, Store & Kantor, isi kota dan ubah nama cabang menjadi nama tempat sebenarnya. Data lama hanya diberi kota bila nama kotanya sudah dikenali; lokasi seperti Blok M tidak ditebak otomatis. Pilih cabang yang benar saat mengedit store.
4. Coba alur dengan akun admin dan crew di lingkungan pengujian. Untuk menghapus lokasi dengan penugasan aktif, buka detail crew dan akhiri penugasannya dahulu. Menonaktifkan akun crew saja tidak mengakhiri penugasan store.

Contoh menjalankan frontend pada Windows PowerShell setelah source diperbarui:

```powershell
cd D:\AbsensiJawara\frontend
npm ci --include=dev
# Jalankan perintah berikut hanya bila instalasi berhasil.
npm run build
```

Gunakan Node.js 24 seperti konfigurasi CI. Tutup proses `npm run dev` sebelum `npm ci` apabila Windows masih mengunci berkas native di `node_modules`. Entry HTML sumber tetap `frontend/index.html`; `dist/index.html` merupakan hasil build yang dibutuhkan deployment. Tidak perlu memindahkannya ke folder assets.

## Verifikasi

- TypeScript dan build produksi frontend berhasil.
- 40 pengujian frontend lulus, termasuk impor CSV, identitas pekerjaan, ekspor, biaya lokasi, dan kalender.
- 47 pengujian backend lulus tanpa dilewati ketika PGlite diaktifkan, termasuk transaksi, otorisasi, dan migrasi database.
- Browser memakai server lokal dan respons API uji: penempatan identitas, halaman tanpa edit, workflow terkunci, lebar layar 375px, audit bernama, penghapusan absensi, unduhan Excel/PDF, GPS/kamera, pengiriman gagal, percobaan ulang, dan fokus dialog sukses lulus.
- PDF hasil unduhan diperiksa: perusahaan, jabatan, kota/cabang, anggota event, omzet, dan pengeluaran mengikuti data uji. Contoh omzet Rp900.000 dan selisih Rp785.000 konsisten dengan tampilan.
- Workflow CI `Crew and event verification` menjalankan kembali pengujian tersebut dengan dependensi terpisah dan menyimpan tangkapan layar/ekspor sebagai artefak CI. Biner browser, `node_modules`, dan hasil QA tidak masuk source repo.

Pemeriksaan SQL memakai database lokal terisolasi. Migrasi baru dan perubahan data **belum diterapkan ke Supabase produksi** dari pengerjaan ini. Pengujian browser memakai respons API uji; pemeriksaan setelah deployment tetap diperlukan untuk konfigurasi produksi dan layanan penyimpanan foto.
