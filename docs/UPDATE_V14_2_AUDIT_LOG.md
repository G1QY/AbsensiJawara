JAWARA V14.2: Audit Log

Perubahan:
- Tindakan memakai kalimat yang mudah dibaca. Kode asli dapat dibuka lewat Kode aktivitas.
- Role lama dan baru tampil untuk perubahan akun.
- Jadwal rentang tanggal menampilkan periode, shift, jumlah karyawan, dan jumlah jadwal yang tersimpan.
- Jadwal massal tidak lagi ditampilkan seolah hanya untuk karyawan pada jadwal pertama.
- Nama karyawan lebih diutamakan daripada kode EMP jika datanya masih tersedia.
- Payroll mengambil nama dari crewId atau snapshot slip dan menampilkan periode.
- Akun pelaksana menampilkan nama profil dan email. Nama JAWARA tidak diganti secara fiktif.
- Pencarian dan filter tindakan berlaku pada maksimal 200 aktivitas terbaru.
- Desktop memakai tabel, mobile memakai kartu. Isi password tidak ditampilkan.

Riwayat asli tidak dihapus, digabung, atau diubah. Nama yang tidak tersimpan dan
sudah tidak ada di database tidak dapat dipulihkan secara pasti. Nama/email hasil
lookup adalah data profil saat ini, bukan rekonstruksi profil pada waktu kejadian.
Tidak ada perubahan database, SQL, dependency, atau environment.

Pemasangan:
Patch V14_2_Audit_Log.patch dapat dipasang pada V14 maupun V14.1.
Patch ini hanya perbaikan audit log. Perubahan notifikasi login V14.1 tetap terpisah.

Simpan perubahan lokal dahulu, lalu salin patch ke folder repo dan jalankan:
git apply --check .\V14_2_Audit_Log.patch
git apply .\V14_2_Audit_Log.patch
cd frontend
npx tsc --noEmit
npm run build

Deploy ulang backend Render dan frontend. Jika git apply --check gagal, periksa
perbedaan source sebelum melanjutkan.

Verifikasi:
4 tes backend lulus untuk lookup nama, payroll, jadwal massal, dan kegagalan lookup.
TypeScript dan build lulus. Browser lulus untuk label, perubahan role, periode,
akun pelaksana, pencarian, filter, mobile, bahasa Inggris, dan pembatasan isi detail.
Patch diperiksa pada source V14 dan V14.1 bersih.
Screenshot memakai data pengujian. Belum push GitHub atau deploy produksi.
