# Pembaruan dashboard, lokasi, bahasa, dan mobile — 15 September 2026

Dasar kode: `main` setelah merge PR #3, commit `409cc8c68704b40c4074ca56b6634d5ab1c72a8f`.
Perubahan sebelumnya (identitas crew di dashboard, peninjauan workflow selesai, detail event, audit bernama, pengarsipan lokasi, penghapusan absensi, dan popup sukses) tetap disertakan.

## Hasil

- Dashboard membaca omzet dari laporan workflow event yang tersimpan. Tunai + transfer dijumlahkan sekali per event, dengan dukungan kolom omzet lama. Enam bulan terakhir ditampilkan berdasarkan tanggal event. Event draft/batal tidak dihitung. Data yang belum diisi dibedakan dari omzet nol. Laporan event yang belum selesai tetap dihitung dan diberi keterangan.
- Kartu payroll menampilkan **Estimasi Payroll Bulan Ini**, memakai fungsi, aturan sesi, jadwal, izin, dan absensi yang sama dengan menu Payroll tanpa filter. Sumber data saat ini belum mempunyai tabel finalisasi/pembayaran payroll; angka ini tidak diklaim sebagai pembayaran final. Grafik menampilkan gaji pokok, bonus, dan potongan.
- Picker lokasi admin memakai satu kolom alamat/pencarian. Mengubah teks membatalkan koordinat lama. Memilih hasil memperbarui alamat, pin, dan koordinat bersama. Hasil pencarian terlambat tidak dapat menimpa input yang lebih baru. Menyimpan ditolak jika alamat belum dipasangkan dengan titik.
- Pencarian alamat memakai Google Geocoding; jika tidak ditemukan, pencarian nama usaha mencoba Places API (New). Hasil ganda ditampilkan untuk dipilih. Tidak ada pencarian otomatis setiap mengetik, membuka form, atau menggeser pin. Google Maps baru dimuat setelah tindakan admin.
- Pilihan titik manual/GPS tetap tersedia. Setelah memindahkan pin, cari alamat titik tersebut atau isi alamat dan tekan konfirmasi titik; tombol konfirmasi menunjukkan koordinatnya.
- Foto baru guest mencetak nama penugasan, **alamat penugasan tersimpan**, GPS perangkat, akurasi, waktu, dan kode foto. Alamat penugasan tidak diklaim sebagai alamat hasil reverse geocoding GPS. Tanpa alamat dari admin, foto menyatakan belum diisi. Foto lama tidak ditulis ulang. Tidak ada geocoding berbayar pada setiap absen.
- Pilihan ID/EN tersedia di topbar, login, dan Pengaturan. Bahasa tersimpan di browser, berlaku pada antarmuka utama dan label laporan, serta tidak mengubah nilai formulir, nama orang, nama lokasi, atau nilai yang dikirim ke API. Input yang sedang dikerjakan tetap ada ketika bahasa diganti. Pesan server yang belum mempunyai padanan kamus tetap menampilkan pesan aslinya.
- Header menyesuaikan layar HP, tombol utama mudah disentuh, kartu ringkasan memakai dua kolom, kartu keuangan melebar, dan dialog/form dapat digulir tanpa melebarkan halaman.

## Pemasangan

Frontend dan backend harus diperbarui bersama. Tidak ada migrasi SQL baru pada V9. Migrasi sebelumnya dari PR #3 tetap menjadi prasyarat. Pembaruan ini tidak menghapus data Supabase.

Paket berisi source lengkap dan `update.patch` terhadap commit dasar di atas. Untuk repo Git yang sudah berada di commit dasar dan tidak memiliki perubahan lokal:

```powershell
git status --short
git switch -c update/dashboard-lokasi-bahasa
git apply --check D:\Download\Jawara_Update_V9\update.patch
```

Jika pemeriksaan berhasil, terapkan:

```powershell
git apply --index D:\Download\Jawara_Update_V9\update.patch
git diff --cached --stat
```

Jika `git apply --check` gagal atau ada perubahan lokal, simpan perubahan lokal dahulu dan bandingkan file dengan folder `AbsensiJawara` dalam paket. Jangan memakai reset/hapus file untuk memaksakan patch. Source lengkap tidak berisi `.env`, `node_modules`, atau `dist`.

Jalankan perintah PowerShell satu per satu (kompatibel dengan Windows PowerShell yang belum mendukung `&&`). Hentikan dev server proyek sebelum `npm ci` jika berkas LightningCSS sedang terkunci.

```powershell
cd D:\AbsensiJawara\backend
npm ci --include=dev
npm start
```

Di terminal kedua:

```powershell
cd D:\AbsensiJawara\frontend
npm ci --include=dev
npx tsc --noEmit
npm run build
npm run dev
```

Setelah pengujian lokal selesai, commit dan push branch; ikuti review PR yang diwajibkan repo. Paket ini tidak melewati aturan review dan belum dideploy otomatis.

## Konfigurasi Google Maps

Gunakan `VITE_GOOGLE_MAPS_API_KEY` pada environment frontend dengan:

1. Maps JavaScript API aktif untuk tampilan peta.
2. Geocoding API aktif untuk alamat dan reverse geocoding eksplisit.
3. Places API (New) aktif untuk pencarian nama usaha jika geocoder tidak menemukan hasil.
4. Billing dan kuota tersedia. API restriction mengizinkan layanan yang dipakai; website restriction mencakup domain frontend serta localhost yang dipakai untuk pengujian.

Build ulang frontend setelah perubahan environment. Status `REQUEST_DENIED`/izin/billing dan kuota ditampilkan lebih jelas. Perbaikan kode tidak dapat mengaktifkan API atau mengubah pembatasan key pada akun Google Anda.

Referensi resmi: [Geocoding Service](https://developers.google.com/maps/documentation/javascript/geocoding), [Text Search (New)](https://developers.google.com/maps/documentation/javascript/place-search).

Alamat lama yang sudah tidak sesuai titiknya perlu dipilih ulang lalu disimpan. Sistem tidak memindahkan titik lama berdasarkan teks secara diam-diam.

## Verifikasi

- 50 tes backend lulus, mencakup tiga tes omzet baru: total tunai/transfer/legacy/nol, paginasi lebih dari 500 event, rentang tahun, kesalahan sumber data, dan pembatasan akses admin.
- 40 tes frontend lulus; TypeScript dan build lulus.
- Alur browser memeriksa dashboard dan kesamaan estimasi payroll, pencarian/pemilihan/penyimpanan lokasi, respons pencarian lama dan ditolak, bahasa serta nilai formulir, watermark guest dan pengiriman ulang, serta regresi workflow/detail event/admin/ekspor.
- Pengujian browser memakai HTTP, kamera, GPS, dan SDK Google tiruan. Akun Google live serta perangkat HP fisik belum diuji. Pemeriksaan Supabase pada sesi ini hanya membaca skema dan ketersediaan data; tidak mengubah produksi.

Untuk menjalankan tes lokasi di CI, build khusus pengujian memakai `VITE_GOOGLE_MAPS_API_KEY=qa-map-fixture`; SDK diganti fixture browser, sehingga tidak ada panggilan Google berbayar. Jangan gunakan nilai fixture ini pada deployment aplikasi.
