# Payroll, jadwal, libur dan izin

Panduan perubahan 6 Oktober 2026. Implementasi berada di repo; penerapan ke produksi memerlukan migrasi database dan deployment backend/frontend.

## Payroll Super Admin

1. Buka **Payroll**, pilih periode, lalu gunakan tab Semua crew, Store & Kantor, atau Crew Event. Filter lokasi, nama, status dan kesiapan membantu memeriksa draft.
2. Buka **Atur aturan tahunan**, pilih tahun dan bulan mulai berlaku. Isi basis gaji, tarif telat/lembur/absen, batas akhir periode dan tanggal pembayaran. Pilih **Pratinjau aturan tahunan** untuk meninjau kalender serta perubahan total draft setiap bulan, lalu **Simpan aturan tahunan**. Sekali simpan berlaku dari bulan mulai sampai Desember untuk seluruh crew, termasuk yang tidak tampil karena filter. Bulan sebelum mulai tetap memakai aturan sebelumnya.
3. Gunakan **Atur banyak crew** untuk memilih draft dari hasil filter. Pilih satu komponen: tunjangan, potongan manual, atau tarif dasar. Nominal mengganti komponen lama pada tiap slip; komponen lain dipertahankan. Pratinjau harus diperiksa sebelum penyimpanan. Maksimal 500 slip per transaksi; kegagalan membatalkan seluruh perubahan dalam transaksi itu.
4. **Periksa draft** menampilkan tarif, unit dibayar, kehadiran, hari libur/izin, tambahan dan potongan. Penyesuaian per crew tetap tersedia. Perubahan komponen yang belum disimpan menonaktifkan tombol finalisasi.
5. Finalkan setelah periode/event dan tinjauan selesai. Bayarkan di luar aplikasi, kemudian catat tanggal dan referensi pembayaran. Slip final menyimpan snapshot; slip dibayar tidak dapat dibuka kembali.

### Batas periode dan pembayaran

| Pengaturan | Arti |
| --- | --- |
| Tahun aturan | Tahun slip payroll, bukan pembayaran sekali setahun. |
| Mulai berlaku | Bulan pertama penerapan, sampai Desember tahun terpilih. Pilih Januari untuk satu tahun penuh. |
| Batas akhir periode | Tanggal terakhir kehadiran yang dihitung, 1–31. Nilai 31 berarti hari terakhir bulan. |
| Tanggal pembayaran | Tanggal rencana pembayaran, 1–31. |
| Bulan pembayaran | Bulan payroll yang sama atau bulan berikutnya. |

- Contoh: batas **25**, bayar **30**, bulan pembayaran **bulan payroll yang sama**. Dalam siklus yang sudah berjalan, payroll Oktober menghitung 26 September–25 Oktober; finalisasi mulai 26 Oktober setelah shift malam dan tinjauan selesai; rencana pembayaran 30 Oktober. Tidak perlu menunggu 1 November.
- Awal setiap periode selalu sehari setelah batas akhir periode sebelumnya. Jika September masih memakai akhir bulan, bulan transisi Oktober menjadi 1–25 Oktober; November menjadi 26 Oktober–25 November. Ini mencegah tanggal ganda/terlewat. Gaji bulanan tetap nominal penuh; prorata transisi tidak dilakukan otomatis dan dapat diatur melalui penyesuaian slip.
- Tanggal 29–31 yang tidak tersedia mengikuti hari terakhir bulan, termasuk tahun kabisat. Rencana pembayaran harus **setelah** akhir periode pada semua bulan sasaran. Contoh batas 31 dan bayar 30 pada bulan yang sama ditolak; pilih batas lebih awal atau bulan pembayaran berikutnya.
- Mengubah batas Desember juga memengaruhi awal Januari tahun berikutnya; pratinjau menampilkan Januari itu tanpa mengubah tarifnya. Batas tanggal tidak boleh berubah jika periode terdampak memiliki slip bulanan final/dibayar. Pilih bulan mulai setelah periode terkunci.
- Aturan tarif dapat memperbarui draft pada periode yang memiliki slip lain sudah final; nilai slip final/dibayar tetap memakai snapshot. Aturan bulanan lama masih dipakai sampai aturan tahunan disimpan. API lama tidak boleh menimpa tarif satu bulan yang sudah dikelola secara tahunan.
- Rencana pembayaran bukan transfer otomatis atau penanda sudah dibayar. Catat tanggal pembayaran sebenarnya setelah pembayaran dilakukan. Payroll event tetap mengikuti event selesai dan tinjauannya, bukan batas periode Store/Kantor.

### Aturan perhitungan

- Nominal profil dan aturan yang sudah tersimpan tidak dikonversi otomatis. Tarif bulanan, harian dan per event memiliki satuan berbeda. Mengubah basis periode memerlukan pemeriksaan tarif semua draft dalam pratinjau.
- Gaji bulanan = tarif × 1. Harian = tarif × jumlah tanggal hadir yang lengkap dan disetujui. Fee per event = tarif × 1 bila ada kehadiran yang disetujui; fee harian event mengikuti tanggal hadir.
- Telat dihitung proporsional per menit atau dibulatkan ke atas per absensi sesuai aturan periode. Lembur memakai jam penuh yang disetujui. Fee event tidak mendapat potongan telat atau tambahan lembur otomatis.
- Hari libur crew dikeluarkan dari kewajiban kerja dan pembagi hari terjadwal. Izin disetujui membebaskan potongan absen otomatis, tetapi tetap termasuk hari terjadwal. Izin tidak memberikan unit kehadiran pada payroll harian/event.
- Potongan absen berlaku pada jadwal yang sudah selesai tanpa kehadiran sah atau izin. Izin/absensi yang masih menunggu tinjauan menahan finalisasi. Lembur dari absensi yang ditolak tidak menahan finalisasi.
- Gaji bersih = gaji/fee + tunjangan + lembur − telat − absen − potongan manual, minimal Rp0. Selisih potongan berlebih tidak dibawa otomatis ke bulan berikutnya.

## Jadwal crew

Pada detail crew → **Atur Jadwal Kerja**, tersedia Kalender, Buat jadwal, dan Libur & izin.

- **Buat jadwal** memakai rentang, pilihan hari dan shift. Tanggal merah/libur nasional/cuti bersama tetap dijadwalkan jika harinya dipilih. Jadwal tanpa absensi diperbarui; jadwal berabsensi dikunci; benturan event/shift dan libur/izin crew dilewati. Hasil menampilkan jumlah tiap kategori.
- Pilih tanggal di **Kalender** untuk membuat/mengubah shift atau mengatur libur/izin.
- **Libur & izin** berlaku pada seluruh tanggal dalam rentang, termasuk akhir pekan. Keterangan wajib. Libur memakai `DAY_OFF`, izin admin memakai `PERMIT`, keduanya langsung `APPROVED`.
- **Aktifkan kerja** membatalkan pengecualian yang ditetapkan admin. Shift awal tetap tersimpan dan aktif kembali. Tanggal yang belum memiliki shift perlu dibuatkan jadwal.
- Tanggal yang memiliki check-in atau payroll final terkunci. Pengajuan izin lain yang bertumpuk harus diselesaikan lebih dahulu. Operasi rentang bersifat atomik: seluruh rentang berhasil atau seluruhnya dibatalkan.
- Kalender pribadi menampilkan Libur crew/Izin serta keterangan. Dashboard dan halaman absensi tidak menawarkan clock-in pada tanggal tersebut. Shift malam tetap memakai tanggal mulai shift; absensi terbuka tetap dapat clock-out.

## Database dan rilis

Migrasi berurutan: [`20261005160149_payroll_schedule_time_off.sql`](../supabase/migrations/20261005160149_payroll_schedule_time_off.sql), lalu [`20261006100934_payroll_annual_calendar.sql`](../supabase/migrations/20261006100934_payroll_annual_calendar.sql). Prasyarat: migrasi payroll `20260925222422_persisted_payroll.sql` sudah terpasang. Pada database yang sudah memiliki objek payroll tetapi histori migrasinya berbeda, rekonsiliasi definisi dan histori lebih dahulu; jangan menjalankan ulang migrasi lama secara buta.

Migrasi menambah tipe `DAY_OFF` dan penanda `admin_managed` pada `permissions`, fungsi `set_crew_day_status`, pengamanan transaksi terhadap absensi/payroll final, serta fungsi `mutate_payroll_adjustments`. `payroll_source` juga mengambil izin event lintas bulan. Fungsi memakai `security invoker` dan hanya dapat dipanggil `service_role`; backend memvalidasi Super Admin. Penulisan langsung `permissions` oleh anon/authenticated dicabut.

Migrasi tahunan menambah `cutoff_day`, `payment_day`, `payment_month_offset`, `annual_year` pada `payroll_policies`. Satu transaksi tahunan menyimpan aturan ke bulan-bulan sasaran; `payroll_year_workspace` menyediakan pratinjau tanpa menulis, `set_payroll_year_policy` menyimpan setelah memeriksa revisi, rentang terkunci dan tanggal bayar. Source payroll mengambil absensi/jadwal/izin mengikuti batas periode aktual. Snapshot baru dan ekspor menyertakan awal/akhir perhitungan serta rencana bayar; pengamanan libur/izin membaca rentang snapshot final.

Urutan rilis: uji migrasi pada database uji → pasang migrasi → deploy backend → deploy frontend → verifikasi kalender, payroll dan absensi sesuai [checklist rilis](RELEASE_CHECKLIST.md). File ini tidak menyatakan migrasi sudah diterapkan di produksi.

## Pengujian

- Backend: unit perhitungan, API payroll/jadwal, kalender/today, serta transaksi/otorisasi SQL melalui PGlite. Aktifkan `PGLITE_MODULE` untuk menjalankan pengujian database.
- Frontend: TypeScript, build, unit test; browser `payroll-persisted-browser.cjs` dan `staff-v13-browser.cjs` mencakup pratinjau, penyesuaian massal, final/dibayar, libur, pemulihan shift, desktop dan mobile. Browser memakai fixture, bukan data produksi.

Hasil verifikasi lokal 6 Oktober 2026: **109 tes backend** (termasuk SQL PGlite) dan **36 tes frontend** berhasil, begitu pula TypeScript dan build. Uji browser payroll tahunan berhasil sampai finalisasi/pembayaran dan akses slip pribadi; uji jadwal sebelumnya juga berhasil. Formulir serta pratinjau tahunan/massal diperiksa pada lebar 360 px, detail payroll dan jadwal pada ukuran mobile serta desktop. Pengujian memverifikasi pratinjau tanpa menulis data, penyimpanan sampai Desember, batas 25/bayar 30, Februari, transisi rentang, kunci slip final lintas tahun, serta larangan finalisasi saat komponen belum disimpan. Browser memakai fixture; SQL dijalankan pada database uji lokal.

Build masih menampilkan peringatan ukuran bundle dan campuran import statis/dinamis jsPDF. Verifikasi ini tidak mencakup penerapan migrasi atau pengujian data produksi.
