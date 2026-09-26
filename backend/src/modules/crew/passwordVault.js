const crypto = require('node:crypto');
const db = require('../../config/supabaseClient');
const { fail, uuid } = require('./crew.validation');

function key() {
  const value = process.env.CREW_PASSWORD_VAULT_KEY || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw fail('Penyimpanan password belum dikonfigurasi di server.', 503);
  return Buffer.from(value, 'base64');
}
function encrypt(password, userId) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(b => b.toString('base64')).join('.');
}
function decrypt(value, userId) {
  const [iv, tag, ciphertext] = value.split('.').map(v => Buffer.from(v, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8');
}
// Only capture passwords explicitly supplied on account creation/admin reset.
// Never collect login passwords or store passwords in metadata, logs or profiles.
async function remember(actorId, authUser, password) {
  try {
    if (!authUser?.updated_at) throw new Error('Missing Auth version');
    const ciphertext = encrypt(password, authUser.id);
    const { error } = await db.rpc('save_crew_password_copy', {
      p_actor: actorId, p_user: authUser.id,
      p_expected_updated_at: authUser.updated_at, p_ciphertext: ciphertext,
    });
    if (error) throw new Error('Vault unavailable');
    return '';
  } catch {
    return 'Akun/password sudah tersimpan, tetapi salinan untuk Super Admin belum tersedia. Periksa konfigurasi penyimpanan password.';
  }
}
async function reveal(req, res, next) {
  res.set('Cache-Control', 'no-store, private');
  res.set('Pragma', 'no-cache');
  try {
    uuid(req.params.id);
    key();
    const { data, error } = await db.rpc('read_crew_password_copy', {p_actor: req.user.id, p_crew: req.params.id});
    if (error) throw fail('Password tidak dapat dibuka.', error.code === '42501' ? 403 : 503);
    if (!data) return res.json({available: false, message: 'Belum tersedia. Password dibuat sebelum fitur ini aktif atau sudah diganti oleh pemilik akun.'});
    let password;
    try { password = decrypt(data.ciphertext, data.user_id); }
    catch { throw fail('Salinan password tidak dapat dibuka dengan kunci server saat ini.', 503); }
    res.json({available: true, password});
  } catch (error) { next(error); }
}
module.exports = {encrypt, decrypt, remember, reveal};
