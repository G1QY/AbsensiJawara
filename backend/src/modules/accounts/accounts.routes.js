const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { uuid, fail } = require('../crew/crew.validation');
router.use(requireRole('SUPER_ADMIN'));
router.get('/', async (req, res, next) => {
  try {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from('users')
        .select('id,full_name,email,is_active,user_roles(role:roles(code,name)),head_store_scopes(city_name),crew(id,crew_type,status,deleted_at)')
        .order('full_name').order('id').range(offset, offset + 499);
      if (error) throw fail('Daftar akun belum tersedia. Pastikan migrasi Head Store sudah dijalankan.', 503);
      rows.push(...data.map(row => ({...row, head_store_scopes: Array.isArray(row.head_store_scopes) ? row.head_store_scopes : row.head_store_scopes ? [row.head_store_scopes] : []})));
      if (data.length < 500) break;
    }
    res.json(rows);
  } catch (error) { next(error); }
});
router.patch('/:id/role', async (req, res, next) => {
  try {
    uuid(req.params.id);
    if (!['SUPER_ADMIN','HEAD_STORE','EVENT_MANAGER','CREW_STORE','CREW_EVENT'].includes(req.body?.role)) throw fail('Role tidak valid.');
    if (req.body.role === 'HEAD_STORE') uuid(req.body.branchId, 'Pilih kota cakupan.');
    const { data, error } = await db.rpc('set_account_role', {
      p_actor: req.user.id, p_user: req.params.id, p_role: req.body.role,
      p_scope_branch: req.body.role === 'HEAD_STORE' ? req.body.branchId : null,
    });
    if (error) throw fail(error.message, error.code === '42501' ? 403 : 400);
    res.json(data);
  } catch (error) { next(error); }
});
module.exports = router;
