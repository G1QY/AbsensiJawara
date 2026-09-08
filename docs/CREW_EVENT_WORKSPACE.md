# Crew Event Workspace

## Yang tersedia

- Sidebar tetap terang dengan menu Dashboard, Event Saya, Absensi, Inventory, Operasional, Riwayat, dan Payroll.
- Event Saya hanya menampilkan event yang ditugaskan admin melalui Kelola Event.
- Workflow 14 langkah disimpan ke tabel `event_workflows`, bukan hanya di browser.
- Foto workflow dikompresi ke JPEG dan disimpan pada bucket privat di folder `event-workflows/`.
- Foto barang dan foto bukti langsung menampilkan preview lokal, lalu memakai signed URL saat data dibuka kembali.
- Inventory dan Operasional membaca data workflow event yang benar-benar sudah diinput.
- Transportasi menyimpan tanggal, jam, layanan, kendaraan, biaya, dan foto bukti. Kuota menyimpan jumlah GB, provider/perangkat, dan biaya.
- PDF event memuat identitas, periode dan jadwal event, lokasi, PIC, tim, transportasi lengkap, operasional, inventory, dan rekap keuangan.
- Workflow langkah 14 memperbarui status event menjadi `COMPLETED` dan penugasan menjadi `ENDED`.
- Payroll crew menampilkan estimasi dari gaji pokok, potongan telat, dan lembur berstatus `APPROVED`.

## Supabase

Jalankan migrasi berikut setelah migrasi sebelumnya:

```text
supabase/migrations/20260901090000_secure_event_workflows.sql
```

Migrasi ini mengaktifkan RLS, mencabut akses langsung `anon`/`authenticated`, dan memastikan `max_reached >= current_step`. Backend memakai service role, lalu memeriksa role `CREW_EVENT` dan kepemilikan penugasan sebelum membaca atau menulis workflow.

Pastikan konfigurasi storage backend (`S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, dan `S3_BUCKET_NAME`) sudah tersedia agar unggah foto workflow berfungsi.

Field operasional tambahan tetap disimpan di JSON `event_workflows.data`, sehingga pembaruan ini tidak memerlukan migrasi SQL baru.
