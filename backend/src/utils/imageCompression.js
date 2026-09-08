// Kompresi foto sebelum upload ke private S3.
// Ref: PRD Section 3 & 14 — "Foto maksimal width 800px, JPEG Quality 80%"

const sharp = require('sharp');
const { MAX_SELFIE_WIDTH_PX, SELFIE_JPEG_QUALITY } = require('../config/constants');

/**
 * @param {Buffer} inputBuffer - buffer foto asli (dari multer memoryStorage)
 * @returns {Promise<Buffer>} buffer JPEG yang sudah dikompresi
 */
async function compressAttendancePhoto(inputBuffer) {
  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length > 8 * 1024 * 1024) throw Object.assign(new Error('Ukuran foto tidak valid.'), {status:413});
  const metadata = await sharp(inputBuffer, {limitInputPixels:20000000}).metadata().catch(()=>{throw Object.assign(new Error('Isi foto tidak valid.'),{status:422});});
  if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw Object.assign(new Error('Foto wajib JPG, PNG, atau WebP statis.'),{status:422});
  return sharp(inputBuffer, {limitInputPixels:20000000}).rotate()
    .resize({ width: MAX_SELFIE_WIDTH_PX, withoutEnlargement: true })
    .jpeg({ quality: SELFIE_JPEG_QUALITY })
    .toBuffer();
}

module.exports = { compressAttendancePhoto };
