// Ringkasan angka untuk kartu dashboard. Karena DB ini sudah khusus
// FotoSnaps, tidak perlu filter tenant_id lagi.
const supabase = require('../../config/supabaseClient');

async function admin(req, res, next) {
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

    const results = await Promise.all([
      supabase.from('crew').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('attendance_logs').select('id', { count: 'exact', head: true }).eq('attendance_date', today).not('check_in', 'is', null),
      supabase.from('attendance_logs').select('id', { count: 'exact', head: true }).eq('attendance_date', today).eq('status', 'LATE'),
      supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'ONGOING'),
    ]);

    if (results.some(result => result.error)) throw Object.assign(new Error('Ringkasan belum dapat dimuat dari database.'), { status: 503 });
    const [totalCrew, hadirHariIni, telatHariIni, eventOngoing] = results.map(result => result.count);
    res.json({ totalCrew, hadirHariIni, telatHariIni, eventOngoing, date: today });
  } catch (err) {
    next(err);
  }
}

async function crew(req, res, next) {
  try {
    const { crewId } = req.query;

    const { data: recentAttendance } = await supabase
      .from('attendance_logs').select('*').eq('crew_id', crewId).order('attendance_date', { ascending: false }).limit(10);

    const { data: pendingPermissions } = await supabase
      .from('permissions').select('*').eq('crew_id', crewId).eq('status', 'PENDING');

    res.json({ recentAttendance, pendingPermissions });
  } catch (err) {
    next(err);
  }
}

module.exports = { admin, crew };
