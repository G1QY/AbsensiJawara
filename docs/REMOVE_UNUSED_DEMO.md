> **Status dokumentasi: Catatan historis.** Isi berikut merekam versi/fitur tertentu dan belum diselaraskan penuh dengan baseline 5 Oktober 2026. Untuk setup, arsitektur, role dan rilis saat ini, gunakan [indeks dokumentasi aktif](README.md). Instruksi patch/SQL dan hasil tes di bawah berlaku pada konteks versi asalnya, bukan otomatis pada checkout sekarang.

# Penghapusan prototipe

Halaman produksi memakai API server. Berkas prototipe yang tidak terjangkau dari entry aplikasi dihapus:

- frontend/src/pages/inventory/StokOpname.tsx
- frontend/src/pages/inventory/Distribusi.tsx
- frontend/src/pages/inventory/LaporanStok.tsx
- frontend/src/pages/inventory/Produksi.tsx
- frontend/src/pages/inventory/MasterProduk.tsx
- frontend/src/pages/inventory/ResepBOM.tsx
- frontend/src/pages/inventory/DashboardStok.tsx
- frontend/src/pages/inventory/PenerimaanBarang.tsx
- frontend/src/pages/shared/PayrollPage.tsx
- frontend/src/pages/crewStore/CsRiwayat.tsx
- frontend/src/pages/crewEvent/CeRiwayat.tsx
- frontend/src/pages/admin/AdminLaporan.tsx
- frontend/src/pages/admin/AdminPayroll.tsx
- frontend/src/pages/admin/AuditLog.tsx
- frontend/src/pages/admin/DetailEvent.tsx
- frontend/src/pages/admin/AdminDashboard.tsx
- frontend/src/pages/admin/KelolaEvent.tsx
- frontend/src/data/dummy.ts
- frontend/src/data/inventoryDummy.ts

Tidak ada perubahan atau penghapusan isi database. Seed role dan fixture pengujian tetap dipertahankan.
