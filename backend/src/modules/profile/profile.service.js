const crypto = require('crypto');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const avatarPattern = userId => new RegExp(`^avatars/${userId}/[a-f0-9-]+\\.jpg$`);
function validateProfile(body) {
  const full_name = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const phone_number = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (full_name.length < 2 || full_name.length > 150) throw fail('Nama harus 2–150 karakter.');
  if (phone_number && !/^\+?[0-9 ()-]{7,30}$/.test(phone_number)) throw fail('Nomor telepon tidak valid.');
  return { full_name, phone_number, updated_at: new Date().toISOString() };
}
function createProfileService({ db, sessionClient, signUrl, upload, remove, resize }) {
  async function authUser(id) {
    const { data, error } = await db.auth.admin.getUserById(id);
    if (error || !data?.user) throw fail('Akun tidak dapat dimuat.', 503);
    return data.user;
  }
  async function get(id, suppliedAuthUser) {
    const user = suppliedAuthUser || await authUser(id);
    const { data: profile, error } = await db.from('users').select('id, full_name, email, phone_number, is_active').eq('id', id).maybeSingle();
    if (error) throw fail('Profil tidak dapat dimuat.', 503);
    if (!profile || !profile.is_active) throw fail('Profil tidak aktif atau tidak ditemukan.', 403);
    // Only the confirmed address supplied by Auth can become the login email.
    if (user.email && profile.email !== user.email) {
      const { error: syncError } = await db.from('users').update({ email: user.email, updated_at: new Date().toISOString() }).eq('id', id);
      if (syncError) throw fail('Email terverifikasi belum dapat disinkronkan. Hubungi admin.', 503);
      profile.email = user.email;
    }
    const key = user.user_metadata?.avatar_key;
    let avatarUrl = '';
    if (typeof key === 'string' && avatarPattern(id).test(key)) avatarUrl = await signUrl(key, 3600);
    return { ...profile, phone: profile.phone_number || '', avatarUrl, pendingEmail: user.new_email || '' };
  }
  async function update(id, body) {
    const fields = validateProfile(body);
    const { data, error } = await db.from('users').update(fields).eq('id', id).eq('is_active', true).select('id, full_name, email, phone_number').maybeSingle();
    if (error) throw fail('Perubahan profil belum tersimpan.', 503);
    if (!data) throw fail('Profil tidak aktif atau tidak ditemukan.', 403);
    return { ...data, phone: data.phone_number || '' };
  }
  async function setAvatar(id, file) {
    if (!file || file.buffer.length > 3 * 1024 * 1024) throw fail('Pilih foto JPG, PNG, atau WebP, maksimal 3 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw fail('Format foto harus JPG, PNG, atau WebP.');
    let jpeg;
    try { jpeg = await resize(file.buffer); } catch { throw fail('File bukan gambar valid atau dimensinya terlalu besar.'); }
    const user = await authUser(id);
    const previous = user.user_metadata?.avatar_key;
    const key = `avatars/${id}/${crypto.randomUUID()}.jpg`;
    await upload(key, jpeg, 'image/jpeg');
    let avatarUrl;
    try {
      avatarUrl = await signUrl(key, 3600);
      const { error } = await db.auth.admin.updateUserById(id, { user_metadata: { avatar_key: key } });
      if (error) throw fail('Foto belum dapat disimpan ke profil.', 503);
    } catch (error) { await remove(key).catch(() => {}); throw error; }
    if (typeof previous === 'string' && avatarPattern(id).test(previous)) await remove(previous).catch(() => {});
    return { avatarUrl };
  }
  async function removeAvatar(id) {
    const user = await authUser(id);
    const key = user.user_metadata?.avatar_key;
    const { error } = await db.auth.admin.updateUserById(id, { user_metadata: { avatar_key: null } });
    if (error) throw fail('Foto belum dapat dihapus.', 503);
    if (typeof key === 'string' && avatarPattern(id).test(key)) await remove(key).catch(() => {});
    return { avatarUrl: '' };
  }
  async function requestEmail(id, body) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) throw fail('Alamat email tidak valid.');
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) throw fail('Masukkan password saat ini.');
    const user = await authUser(id);
    if (email === user.email?.toLowerCase()) throw fail('Email baru sama dengan email saat ini.');
    // Isolated per request: never attach a user's session to the service-role DB client.
    const client = sessionClient();
    const { data: login, error: loginError } = await client.auth.signInWithPassword({ email: user.email, password: body.currentPassword });
    if (loginError || login?.user?.id !== id) throw fail('Password saat ini salah.', 400);
    try {
      const { data, error } = await client.auth.updateUser({ email });
      if (error) throw fail('Permintaan gagal. Periksa alamat email, batas pengiriman, dan konfigurasi email Supabase.');
      return { pendingEmail: data?.user?.new_email || email, message: 'Permintaan dikirim. Periksa email lama dan baru, lalu selesaikan konfirmasi yang diminta Supabase. Setelah itu masuk ulang memakai email baru.' };
    } finally {
      if (login?.session?.access_token) await db.auth.admin.signOut(login.session.access_token, 'local').catch(() => {});
    }
  }
  return { get, update, setAvatar, removeAvatar, requestEmail };
}
module.exports = { createProfileService, validateProfile, avatarPattern };
