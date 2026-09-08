const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const db = require('../../config/supabaseClient');
const { s3, BUCKET_NAME } = require('../../config/s3Client');
const { getSignedDownloadUrl, uploadPrivateObject } = require('../../utils/signedUrl');
const { createProfileService } = require('./profile.service');
const sessionClient = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const service = createProfileService({
  db, sessionClient, signUrl: getSignedDownloadUrl, upload: uploadPrivateObject,
  remove: key => s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key })),
  resize: buffer => sharp(buffer, { limitInputPixels: 20_000_000 }).rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
});
module.exports = { service, sessionClient };
