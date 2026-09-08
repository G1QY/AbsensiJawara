// Private S3 client — untuk foto absensi, waste, event checklist, dan Auto-PDF report.
// Ref: PRD Section 11 (Storage Architecture)
//
// Struktur bucket (khusus FotoSnaps, tidak ada lagi folder per tenant):
//   attendance/yyyy/mm/{user_id}_{timestamp}.jpg
//   waste/
//   event-checklists/
//   inspection-reports/{report_number}.pdf
//
// Bucket WAJIB private. Akses selalu lewat signed URL (lihat utils/signedUrl.js).

const { S3Client } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT, // isi jika pakai Supabase Storage / non-AWS S3-compatible
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'fotosnaps-private';

module.exports = { s3, BUCKET_NAME };
