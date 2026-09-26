// Resolve only known tables and columns. Audit snapshots remain unchanged.
const targets = {
  branches: 'id,name', stores: 'id,name', events: 'id,event_name', users: 'id,full_name',
  crew: 'id,employee_code,user:users(full_name)',
  attendance_logs: 'id,attendance_date,crew:crew(user:users(full_name))',
  store_schedules: 'id,schedule_date,assignment:store_assignments(crew:crew(user:users(full_name)))',
  guest_attendances: 'id,full_name',
};
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
function displayName(row) {
  if (!row) return null;
  const person = row.user?.full_name || row.crew?.user?.full_name || row.assignment?.crew?.user?.full_name;
  const date = row.attendance_date || row.schedule_date;
  return row.name || row.event_name || row.full_name || (person ? person + (date ? ' • ' + date : '') : null);
}
function payrollCrew(row) {
  return row.new_data?.data?.crewId || row.old_data?.crew_id || row.old_data?.snapshot?.person?.id;
}
async function describe(supabase, rows) {
  const names = new Map();
  await Promise.all(Object.entries(targets).map(async ([table, columns]) => {
    const ids = [...new Set([
      ...rows.filter(r => r.entity_type === table).map(r => r.entity_id),
      ...(table === 'crew' ? rows.filter(r => r.entity_type === 'payroll').map(payrollCrew) : []),
    ].filter(uuid))];
    if (!ids.length) return;
    const { data, error } = await supabase.from(table).select(columns).in('id', ids);
    if (error) throw Object.assign(new Error('Gagal membaca nama pada audit log.'), {status: 500});
    for (const row of data || []) names.set(table + ':' + row.id, displayName(row) || row.employee_code);
  }));
  return rows.map(row => {
    const next = row.new_data, prev = row.old_data;
    let name = displayName(next) || displayName(prev) || names.get(row.entity_type + ':' + row.entity_id);
    if (row.entity_type === 'payroll') {
      name = next?.data?.person?.full_name || prev?.snapshot?.person?.full_name || names.get('crew:' + payrollCrew(row));
      if (!name && row.action === 'PAYROLL_POLICY') name = 'Aturan payroll';
    }
    // Range requests can include several people; the first schedule is not the whole target.
    if (row.action === 'STORE_SCHEDULE_RANGE_CREATED' && next?.crewCount > 1) name = `Jadwal ${next.crewCount} karyawan`;
    return {...row,
      actor_name: row.actor?.full_name || row.actor?.email || (row.actor_user_id ? 'Pengguna tidak tersedia' : 'Sistem / akun tidak tersedia'),
      entity_name: name || next?.employee_code || prev?.employee_code || 'Nama data tidak tersedia',
    };
  });
}
module.exports = {describe};
