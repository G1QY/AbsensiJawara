const router = require('express').Router();
const supabase = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// Own-profile routes must precede /:id. Authentication and role checks run in app.js.
router.use('/me', require('../profile/profile.routes'));

// GET /users — daftar semua profil (admin only)
// NOTE: pembuatan user baru TIDAK lewat sini lagi — semua akun (termasuk
// admin lain) dibuat lewat Supabase Auth Admin API. Lihat pola di
// modules/crew/crew.controller.js (create) atau scripts/bootstrap-admin.js
// untuk akun admin pertama.
router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number, is_active, user_roles(role:roles(code, name))');
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /users/:id — update profil dasar (bukan password/email — itu lewat Auth Admin API)
router.patch('/:id', requireRole(ROLES.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { fullName, phoneNumber, isActive } = req.body;
    const { data, error } = await supabase
      .from('users')
      .update({
        ...(fullName && { full_name: fullName }),
        ...(phoneNumber && { phone_number: phoneNumber }),
        ...(isActive !== undefined && { is_active: isActive }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'User tidak ditemukan.' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
