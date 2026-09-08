const router = require('express').Router();
const supabase = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET /audit-logs — read-only, admin only
router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), async (req, res, next) => {
  try {
    const { entityType, from, to } = req.query;
    let query = supabase.from('audit_logs').select('*, actor:users(full_name, email)');

    if (entityType) query = query.eq('entity_type', entityType);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
