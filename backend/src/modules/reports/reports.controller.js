// GET /reports/attendance, /reports/events — data mentah siap export.
const supabase = require('../../config/supabaseClient');

async function attendance(req, res, next) {
  try {
    const { from, to } = req.query;
    let query = supabase.from('attendance_logs').select('*, crew:crew(employee_code, user:users(full_name))');
    if (from) query = query.gte('attendance_date', from);
    if (to) query = query.lte('attendance_date', to);

    const { data, error } = await query.order('attendance_date', { ascending: false }).limit(1000);
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function events(req, res, next) {
  try {
    const { status } = req.query;
    let query = supabase.from('events').select('*');
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('event_date', { ascending: false });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { attendance, events };
