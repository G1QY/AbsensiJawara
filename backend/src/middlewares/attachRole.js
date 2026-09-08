const supabase = require('../config/supabaseClient');

async function attachRole(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role:roles(code)')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data?.role?.code) {
      return res.status(403).json({ message: 'Role pengguna belum ditetapkan. Hubungi admin.' });
    }
    req.role = data.role.code;
    next();
  } catch (error) {
    console.error('[attachRole] Gagal membaca role:', error.message);
    return res.status(503).json({ message: 'Tidak dapat memverifikasi hak akses.' });
  }
}

module.exports = attachRole;
