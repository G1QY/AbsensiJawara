const router = require('express').Router();
const supabase = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// Only server-defined tables/columns may be used to resolve audit targets.
const targets = {
  branches: 'id,name', stores: 'id,name', events: 'id,event_name', users: 'id,full_name',
  crew: 'id,employee_code,user:users(full_name)',
  attendance_logs: 'id,attendance_date,crew:crew(user:users(full_name))',
  store_schedules: 'id,schedule_date,assignment:store_assignments(crew:crew(user:users(full_name)))',
  guest_attendances: 'id,full_name',
};
function displayName(row) {
  if (!row) return null;
  const person = row.user?.full_name || row.crew?.user?.full_name || row.assignment?.crew?.user?.full_name;
  const date = row.attendance_date || row.schedule_date;
  return row.name || row.event_name || row.full_name || (person ? person + (date ? ' • ' + date : '') : null) || row.employee_code || null;
}
async function describe(rows) {
  const names = new Map();
  await Promise.all(Object.entries(targets).map(async ([table, columns]) => {
    const ids = [...new Set(rows.filter(r => r.entity_type === table && r.entity_id).map(r => r.entity_id))];
    if (!ids.length) return;
    const { data, error } = await supabase.from(table).select(columns).in('id', ids);
    if (!error) for (const row of data || []) names.set(table + ':' + row.id, displayName(row));
  }));
  return rows.map(row => ({ ...row,
    actor_name: row.actor?.full_name || row.actor?.email || (row.actor_user_id ? 'Pengguna tidak tersedia' : 'Sistem / akun tidak tersedia'),
    entity_name: displayName(row.new_data) || displayName(row.old_data) || names.get(row.entity_type + ':' + row.entity_id) || 'Nama data tidak tersedia',
  }));
}

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

    res.json(await describe(data));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
