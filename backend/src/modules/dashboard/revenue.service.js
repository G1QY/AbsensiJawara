const fail = (message, status) => Object.assign(new Error(message), { status });

function revenuePeriod(month) {
  if (typeof month !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month))
    throw fail('Periode omzet harus YYYY-MM.', 400);
  const [year, number] = month.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, index) => ({
    month: new Date(Date.UTC(year, number - 6 + index, 1)).toISOString().slice(0, 7),
    revenue: 0, recordedEvents: 0, missingEvents: 0, unfinishedEvents: 0,
  }));
  return { months, from: months[0].month + '-01', until: new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 10) };
}

async function loadRevenue(db, month) {
  const { months, from, until } = revenuePeriod(month);
  const byMonth = new Map(months.map(row => [row.month, row]));
  // One row per event, never per crew. Pagination prevents the API row limit truncating totals.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('events')
      .select('id,event_date,status,workflow:event_workflows(data,max_reached)')
      .gte('event_date', from).lt('event_date', until)
      .not('status', 'in', '(DRAFT,CANCELLED)').order('id').range(offset, offset + 499);
    if (error || !Array.isArray(data)) throw fail('Omzet event belum dapat dimuat. Coba muat ulang.', 503);
    for (const event of data) {
      const bucket = byMonth.get(event.event_date?.slice(0, 7));
      if (!bucket || ['DRAFT', 'CANCELLED'].includes(event.status)) continue;
      const workflow = Array.isArray(event.workflow) ? event.workflow[0] : event.workflow;
      const values = workflow?.data || {};
      const split = values.omset_tunai !== undefined || values.omset_transfer !== undefined;
      const keys = split ? ['omset_tunai', 'omset_transfer'] : ['omset_nominal'];
      const present = keys.some(key => values[key] !== undefined && values[key] !== null && values[key] !== '');
      if (!present) { bucket.missingEvents++; continue; }
      let total = 0;
      for (const key of keys) {
        const amount = Number(values[key] ?? 0);
        if (!Number.isFinite(amount) || amount < 0) throw fail('Omzet event berisi angka tidak valid. Periksa data workflow.', 422);
        total += amount;
      }
      bucket.revenue += total;
      bucket.recordedEvents++;
      if (Number(workflow.max_reached) < 15) bucket.unfinishedEvents++;
    }
    if (data.length < 500) break;
  }
  return { month, months, current: months[5] };
}

module.exports = { loadRevenue, revenuePeriod };
