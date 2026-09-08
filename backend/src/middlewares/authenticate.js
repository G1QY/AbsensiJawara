const supabase = require('../config/supabaseClient');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan.' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      const { data: profile, error: profileError } = await supabase.from('users').select('is_active').eq('id', data.user.id).maybeSingle();
      if (profileError) return res.status(503).json({ message: 'Status akun belum dapat diverifikasi.' });
      if (!profile?.is_active) return res.status(401).json({ message: 'Akun nonaktif. Hubungi admin.' });
      req.user = { id: data.user.id, email: data.user.email };
      return next();
    }
  } catch (error) {
    console.error('[authenticate] Supabase Auth tidak dapat memverifikasi token:', error.message);
  }

  return res.status(401).json({ message: 'Token tidak valid atau kedaluwarsa.' });
}

module.exports = authenticate;
