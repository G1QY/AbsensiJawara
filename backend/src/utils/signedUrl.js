// Signed URL generator — bucket private, akses selalu lewat URL bertanda-tangan.
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3, BUCKET_NAME } = require('../config/s3Client');

const DEFAULT_EXPIRY_SECONDS = 60 * 10;

async function getSignedDownloadUrl(key, expiresIn = DEFAULT_EXPIRY_SECONDS) {
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3, command, { expiresIn });
}

async function getSignedUploadUrl(key, contentType, expiresIn = DEFAULT_EXPIRY_SECONDS) {
  const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType });
  return getSignedUrl(s3, command, { expiresIn });
}

async function uploadPrivateObject(key, body, contentType = 'application/octet-stream') {
  const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: body, ContentType: contentType });
  await s3.send(command);
  return key;
}

// Database ini sudah khusus FotoSnaps, jadi tidak perlu prefix tenant lagi.
function buildAttendanceKey(userId) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `attendance/${yyyy}/${mm}/${userId}_${now.getTime()}.jpg`;
}

function buildInspectionReportKey(reportNumber) {
  return `inspection-reports/${reportNumber}.pdf`;
}

module.exports = { getSignedDownloadUrl, getSignedUploadUrl, uploadPrivateObject, buildAttendanceKey, buildInspectionReportKey };
