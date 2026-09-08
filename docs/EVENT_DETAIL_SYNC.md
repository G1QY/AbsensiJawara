# Sinkronisasi detail event

Admin dan Crew Event memakai event, penugasan, jadwal, dan event_workflows yang sama.

- Detail admin memperbarui data setiap 15 detik dan saat tab kembali aktif. Form edit tidak direset oleh refresh.
- Tab Inventory dan Operasional admin menampilkan data serta foto yang disimpan crew. Keduanya tersedia sebagai detail baca pada Event Saya dengan komponen tampilan yang sama.
- Foto absensi admin mencakup clock in, setup ready, selesai event, dan clock out setiap crew. Foto private tetap melalui endpoint bertanda tangan dengan pemeriksaan role dan event.
- Status event berasal dari events.status. Clock out dan akhir penugasan individu tidak lagi mengubah label status seluruh event di halaman daftar crew atau PDF. Penyelesaian workflow tetap memperbarui status melalui proses backend yang sudah ada.
- Tugas baru admin memakai Tenda/Fotobox. PIC tetap atribut tersendiri. Riwayat tugas lama dipertahankan dan tampil pada kedua sisi.
- Daftar anggota memuat posisi dan status penugasan. Jumlah crew aktif tidak menghitung penugasan ENDED.
- PDF admin memakai generator laporan event yang sama dengan crew, termasuk operasional, inventory, dan foto. Admin mencakup absensi semua anggota; crew tetap mendapat absensinya sendiri.
- Workflow terbuka menerima metadata event terbaru. Pembaruan data workflow dari anggota lain diterapkan jika tidak ada input lokal yang belum disimpan. Input lokal yang berkonflik tetap ditahan di layar dan penyimpanan menggunakan pemeriksaan versi.

Tidak ada migrasi database baru. Build ulang frontend dan restart backend. Belum diterapkan ke produksi atau diuji menggunakan database produksi. Tes endpoint memakai database mock; integration test database terpisah tetap diperlukan.
