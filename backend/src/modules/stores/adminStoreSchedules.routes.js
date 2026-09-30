const {shiftNumber,adjacentDate,overlaps}=require('../../utils/workShift');
const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { logAudit } = require('../../utils/auditLogger');
const { uuid, fail } = require('../crew/crew.validation');
const { syncHolidayYear, ensureHolidayYears } = require('../../services/nationalHolidaySync');

async function readAll(makeQuery){const rows=[];for(let offset=0;;offset+=500){const result=await makeQuery().range(offset,offset+499);if(result.error)return result;rows.push(...(result.data||[]));if((result.data||[]).length<500)return {data:rows,error:null};}}

router.use((req,res,next) => requireRole(...(req.method === 'GET' && req.path === '/payroll-context' ? ['SUPER_ADMIN','EVENT_MANAGER'] : ['SUPER_ADMIN']))(req,res,next));

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw fail('Tanggal jadwal tidak valid.');
  return value;
}
function time(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) throw fail('Jam jadwal tidak valid.');
  return value;
}
function check(error, fallback = 'Jadwal Store tidak dapat diproses.') {
  if (error?.code==='23P01') throw fail(error.message,409);
  if (error?.code==='23505') throw fail('Jadwal pada tanggal ini sudah ada. Muat ulang.',409);
  if (error) throw fail(error.code === '42501' ? 'Anda tidak memiliki akses untuk mengatur jadwal Store.' : fallback, error.code === '42501' ? 403 : 422);
}
async function assignmentFor(crewId, scheduleDate) {
  const { data, error } = await db.from('store_assignments')
    .select('id,crew_id,start_date,end_date,status,store:stores(id,name,status),crew:crew(crew_type,status,deleted_at,user:users(is_active))')
    .eq('crew_id', crewId).eq('status', 'ACTIVE').lte('start_date', scheduleDate).order('start_date', { ascending: false }).limit(2);
  check(error, 'Penugasan Store crew tidak dapat dibaca.');
  const rows = (data || []).filter(a => !a.end_date || a.end_date >= scheduleDate);
  if (!rows.length) throw fail('Crew belum memiliki penugasan Store aktif pada tanggal tersebut.', 422);
  if (rows.length > 1) throw fail('Crew memiliki lebih dari satu penugasan Store aktif. Rapikan penugasan terlebih dahulu.', 409);
  const a = rows[0];
  if (a.crew?.crew_type !== 'CREW_STORE' || a.crew?.status !== 'ACTIVE' || a.crew?.deleted_at || !a.crew?.user?.is_active || a.store?.status !== 'ACTIVE') throw fail('Crew atau Store tidak aktif.', 422);
  return a;
}

function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw fail('Periode bulan tidak valid.');
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return { start, end };
}

function datesBetween(startDate, endDate) {
  const start = date(startDate);
  const end = date(endDate);
  if (start > end) throw fail('Tanggal selesai harus sama atau setelah tanggal mulai.');
  const result = [];
  for (let value = new Date(`${start}T00:00:00Z`); value <= new Date(`${end}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1)) {
    result.push(value.toISOString().slice(0, 10));

  }
  return result;
}

async function createRange({ crewIds, storeId, startDate, endDate, startTime, endTime, shiftNumber: shift, lateToleranceMinutes, overtimePreapproved, workDays }, actorUserId) {
  const dates = datesBetween(startDate, endDate);
  const start = dates[0], end = dates[dates.length - 1];
  const startClock = time(startTime), endClock = time(endTime);
  if (startClock === endClock) throw fail('Jam masuk dan pulang tidak boleh sama.');
  const selectedShift=shiftNumber(shift);
  const tolerance = Number(lateToleranceMinutes ?? 0);
  if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 240) throw fail('Toleransi keterlambatan harus 0 sampai 240 menit.');
  if (typeof overtimePreapproved !== 'boolean') throw fail('Pilihan persetujuan lembur wajib berupa ya atau tidak.');
  const selectedDays = [...new Set((workDays || [1,2,3,4,5,6]).map(Number))];
  if (!selectedDays.length || selectedDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw fail('Hari kerja hanya dapat dipilih dari Minggu sampai Sabtu.');

  let assignmentQuery = db.from('store_assignments')
    .select('id,crew_id,store_id,start_date,end_date,status,store:stores(id,name,status),crew:crew(crew_type,status,deleted_at,user:users(is_active))')
    .eq('status', 'ACTIVE');
  if (storeId) { uuid(storeId); assignmentQuery = assignmentQuery.eq('store_id', storeId); }
  if (crewIds?.length) assignmentQuery = assignmentQuery.in('crew_id', crewIds);
  const { data: assignmentRows, error: assignmentError } = await readAll(()=>assignmentQuery.order('id'));
  check(assignmentError, 'Penugasan Crew Store tidak dapat dibaca.');
  const assignments = (assignmentRows || []).filter(a => a.start_date <= end && (!a.end_date || a.end_date >= start) && a.store?.status === 'ACTIVE' && a.crew?.crew_type === 'CREW_STORE' && a.crew?.status === 'ACTIVE' && !a.crew?.deleted_at && a.crew?.user?.is_active);
  if (!assignments.length) throw fail('Tidak ada Crew Store aktif yang sesuai dengan pilihan.', 422);
  for (const crewId of new Set(assignments.map(row => row.crew_id))) {
    const owned = assignments.filter(row => row.crew_id === crewId);
    if (dates.some(scheduleDate => owned.filter(row => row.start_date <= scheduleDate && (!row.end_date || row.end_date >= scheduleDate)).length > 1)) {
      throw fail('Terdapat crew dengan penugasan Store aktif yang bertumpuk. Rapikan penugasan sebelum membuat jadwal.', 409);
    }
  }
  const assignmentIds = assignments.map(a => a.id);
  const selectedCrewIds = [...new Set(assignments.map(a => a.crew_id))];
  const calendarYears = [...new Set(dates.map(value => value.slice(0, 4)))];

  const calendarResults = await ensureHolidayYears(calendarYears);
  const warnings = calendarResults.filter(row=>row.warning).map(row=>row.warning);

  const [holidayResult, existingResult, eventAssignmentResult] = await Promise.all([
    readAll(()=>db.from('national_holidays').select('holiday_date,name,kind').gte('holiday_date', `${calendarYears[0]}-01-01`).lte('holiday_date', `${calendarYears.at(-1)}-12-31`).order('holiday_date')),
    readAll(()=>db.from('store_schedules').select('id,store_assignment_id,schedule_date,start_time,end_time,store_assignment:store_assignments!inner(crew_id,status,start_date,end_date)').in('store_assignment.crew_id', selectedCrewIds).gte('schedule_date', adjacentDate(start,-1)).lte('schedule_date', adjacentDate(end,1)).order('id')),
    readAll(()=>db.from('event_assignments').select('id,crew_id').in('crew_id', selectedCrewIds).eq('status', 'ACTIVE').order('id')),
  ]);
  check(holidayResult.error, 'Kalender libur nasional belum siap. Jalankan migrasi kalender kerja.');
  check(existingResult.error);
  check(eventAssignmentResult.error, 'Benturan jadwal Event tidak dapat diperiksa.');
  const eventAssignments = eventAssignmentResult.data || [];
  let eventSchedules = [];
  if (eventAssignments.length) {
    const result = await readAll(()=>db.from('event_schedules').select('event_assignment_id,schedule_date,start_time,end_time').in('event_assignment_id', eventAssignments.map(row => row.id)).gte('schedule_date', adjacentDate(start,-1)).lte('schedule_date', adjacentDate(end,1)).eq('status', 'ACTIVE').order('id'));
    check(result.error, 'Benturan jadwal Event tidak dapat diperiksa.');
    eventSchedules = result.data || [];
  }
  const eventCrewByAssignment = new Map(eventAssignments.map(row => [row.id, row.crew_id]));
  const eventConflicts = new Set(eventSchedules.map(row => `${eventCrewByAssignment.get(row.event_assignment_id)}:${row.schedule_date}`));
  const holidays = new Set((holidayResult.data || []).map(row => row.holiday_date));
  // Map existing schedules by "store_assignment_id:schedule_date" -> row (for update path)
  const existingMap = new Map((existingResult.data || []).map(row => [`${row.store_assignment_id}:${row.schedule_date}`, row]));
  const toInsert = [];
  const toUpdate = []; // { existingId, payload }
  let skippedHoliday = 0, skippedExisting = 0, skippedEvent = 0, skippedDay = 0, skippedOverlap = 0;
  for (const assignment of assignments) {
    for (const scheduleDate of dates) {
      if (scheduleDate < assignment.start_date || (assignment.end_date && scheduleDate > assignment.end_date)) continue;
      const day = new Date(`${scheduleDate}T00:00:00Z`).getUTCDay();
      if (holidays.has(scheduleDate)) { skippedHoliday += 1; continue; }
      if (!selectedDays.includes(day)) { skippedDay += 1; continue; }
      if (eventConflicts.has(`${assignment.crew_id}:${scheduleDate}`)) { skippedEvent += 1; continue; }
      const candidate = { schedule_date: scheduleDate, start_time: startClock, end_time: endClock };
      const existingRow = existingMap.get(`${assignment.id}:${scheduleDate}`);
      if (existingRow) {
        // Sudah ada jadwal — masukkan ke antrian update (attendance dicek saat eksekusi)
        toUpdate.push({ existingId: existingRow.id, payload: { shift_number: selectedShift, start_time: startClock, end_time: endClock, late_tolerance_minutes: tolerance, overtime_preapproved: overtimePreapproved } });
      } else {
        // Periksa tumpang tindih hanya untuk jadwal baru
        if ((existingResult.data||[]).some(row=>row.store_assignment?.crew_id===assignment.crew_id&&row.store_assignment?.status==='ACTIVE'&&row.start_time&&overlaps(candidate,row))) { skippedOverlap++; continue; }
        if (eventSchedules.some(row=>eventCrewByAssignment.get(row.event_assignment_id)===assignment.crew_id&&row.start_time&&overlaps(candidate,row))) { skippedOverlap++; continue; }
        toInsert.push({ shift_number: selectedShift, store_assignment_id: assignment.id, schedule_date: scheduleDate, start_time: startClock, end_time: endClock, late_tolerance_minutes: tolerance, overtime_preapproved: overtimePreapproved });
      }
    }
  }
  let saved = [];
  // Insert jadwal baru (batch)
  if (toInsert.length) {
    for (let offset = 0; offset < toInsert.length; offset += 500) {
      const batch = toInsert.slice(offset, offset + 500);
      const result = await db.from('store_schedules').insert(batch).select('id,store_assignment_id,schedule_date,start_time,end_time,shift_number,late_tolerance_minutes,overtime_preapproved');
      check(result.error);
      saved.push(...(result.data || []));
    }
  }
  // Update jadwal yang sudah ada — lewati yang sudah ada absensinya
  let updatedCount = 0, lockedByAttendance = 0;
  if (toUpdate.length) {
    // Ambil semua ID yang ada di attendance_logs sekaligus
    const allExistingIds = toUpdate.map(item => item.existingId);
    const attendedSet = new Set();
    for (let offset = 0; offset < allExistingIds.length; offset += 500) {
      const chunk = allExistingIds.slice(offset, offset + 500);
      const { data: attended, error: attendedError } = await db.from('attendance_logs').select('store_schedule_id').in('store_schedule_id', chunk);
      check(attendedError, 'Pemakaian jadwal tidak dapat diperiksa.');
      (attended || []).forEach(row => attendedSet.add(row.store_schedule_id));
    }
    for (const item of toUpdate) {
      if (attendedSet.has(item.existingId)) { lockedByAttendance += 1; continue; }
      const { data: updatedRow, error: updateError } = await db.from('store_schedules').update(item.payload).eq('id', item.existingId).select('id,store_assignment_id,schedule_date,start_time,end_time,shift_number,late_tolerance_minutes,overtime_preapproved').single();
      check(updateError);
      saved.push(updatedRow);
      updatedCount += 1;
    }
  }
  if (saved.length) {
    await logAudit({ actorUserId, action: 'STORE_SCHEDULE_RANGE_CREATED', entityType: 'store_schedules', entityId: saved[0]?.id || null, oldData: null, newData: { startDate: start, endDate: end, crewCount: selectedCrewIds.length, inserted: toInsert.length, updated: updatedCount, lockedByAttendance, shiftNumber: selectedShift } });
  }
  return { warnings, created: saved.length, inserted: toInsert.length, updated: updatedCount, lockedByAttendance, crewCount: selectedCrewIds.length, skippedHoliday, skippedExisting, skippedEvent, skippedDay, skippedOverlap, schedules: saved };
}

router.get('/holidays', async (req, res, next) => {
  try {
    const start = date(req.query.from), end = date(req.query.to);
    if(start>end)throw fail('Tanggal selesai harus setelah tanggal mulai.');
    const calendarResults=await ensureHolidayYears(Array.from({length:Number(end.slice(0,4))-Number(start.slice(0,4))+1},(_,i)=>Number(start.slice(0,4))+i));
    const { data, error } = await db.from('national_holidays').select('holiday_date,name,kind').gte('holiday_date', start).lte('holiday_date', end).order('holiday_date');
    check(error, 'Kalender libur nasional belum siap.');
    res.json(req.query.metadata==='true'?{holidays:data||[],warnings:calendarResults.filter(row=>row.warning).map(row=>row.warning)}:data||[]);
  } catch (error) { next(error); }
});

router.post('/holidays/sync', async (req, res, next) => {
  try {
    const result = await syncHolidayYear(req.body.year, { force: true });
    await logAudit({ actorUserId: req.user.id, action: 'NATIONAL_HOLIDAY_SYNCED', entityType: 'national_holidays', entityId: null, oldData: null, newData: result });
    res.json(result);
  } catch (error) { next(error); }
});

router.get('/payroll-context', async (req, res, next) => {
  try {
    const { start, end } = monthBounds(req.query.month);
    const [scheduleResult, permissionResult] = await Promise.all([
      readAll(()=>db.from('store_schedules').select('schedule_date,store_assignment:store_assignments!inner(crew_id)').gte('schedule_date', start).lte('schedule_date', end).order('id')),
      readAll(()=>db.from('permissions').select('crew_id,start_date,end_date,type,status').eq('status', 'APPROVED').lte('start_date', end).gte('end_date', start).order('id')),
    ]);
    check(scheduleResult.error, 'Jadwal payroll tidak dapat dimuat.');
    check(permissionResult.error, 'Izin crew tidak dapat dimuat.');
    res.json({ schedules: (scheduleResult.data || []).map(row => ({ crew_id: row.store_assignment?.crew_id, schedule_date: row.schedule_date })).filter(row => row.crew_id), permissions: permissionResult.data || [] });
  } catch (error) { next(error); }
});

router.post('/range', async (req, res, next) => {
  try {
    uuid(req.body.crewId);
    res.status(201).json(await createRange({ ...req.body, crewIds: [req.body.crewId] }, req.user.id));
  } catch (error) { next(error); }
});

router.post('/bulk', async (req, res, next) => {
  try {
    const crewIds = Array.isArray(req.body.crewIds) ? [...new Set(req.body.crewIds)] : [];
    if (crewIds.length > 500) throw fail('Maksimal 500 crew dalam satu proses.');
    crewIds.forEach(uuid);
    if (!req.body.storeId && !crewIds.length) throw fail('Pilih Store atau crew yang akan dijadwalkan.');
    res.status(201).json(await createRange({ ...req.body, crewIds: crewIds.length ? crewIds : null }, req.user.id));
  } catch (error) { next(error); }
});

router.get('/crew/:crewId', async (req, res, next) => {
  try {
    uuid(req.params.crewId);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
    const start = `${month}-01`;
    const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const { data: assignments, error: assignmentError } = await db.from('store_assignments').select('id,start_date,end_date,status,store:stores(id,name,status)').eq('crew_id', req.params.crewId).eq('status', 'ACTIVE').order('start_date', { ascending: false }).limit(2);
    check(assignmentError, 'Penugasan Store crew tidak dapat dibaca.');
    const assignment = (assignments || []).find(a => a.start_date <= end && (!a.end_date || a.end_date >= start)) || null;
    if (!assignment) return res.json({ assignment: null, schedules: [] });
    const { data: schedules, error } = await db.from('store_schedules').select('id,schedule_date,start_time,end_time,shift_number,late_tolerance_minutes,overtime_preapproved').eq('store_assignment_id', assignment.id).gte('schedule_date', start).lte('schedule_date', end).order('schedule_date');
    check(error, 'Jadwal Store tidak dapat dibaca.');
    res.json({ assignment, schedules: schedules || [] });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    uuid(req.body.crewId);
    const scheduleDate = date(req.body.scheduleDate);
    const startTime = time(req.body.startTime);
    const endTime = time(req.body.endTime);
    if (startTime === endTime) throw fail('Jam masuk dan pulang tidak boleh sama.');
    const selectedShift = shiftNumber(req.body.shiftNumber);
    const tolerance = Number(req.body.lateToleranceMinutes ?? 0);
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 240) throw fail('Toleransi keterlambatan harus 0 sampai 240 menit.');
    if (typeof req.body.overtimePreapproved !== 'boolean') throw fail('Pilihan persetujuan lembur wajib berupa ya atau tidak.');

    const { data: conflict, error: conflictError } = await db.from('event_schedules').select('id,event_assignment:event_assignments!inner(crew_id,status)').eq('event_assignment.crew_id', req.body.crewId).eq('event_assignment.status', 'ACTIVE').eq('schedule_date', scheduleDate).eq('status', 'ACTIVE').limit(1);
    check(conflictError, 'Benturan jadwal Event tidak dapat diperiksa.');
    if (conflict?.length) throw fail('Crew sudah memiliki jadwal Event aktif pada tanggal ini.', 409);

    // Jika scheduleId dikirim (mode edit), fetch langsung by ID
    // tanpa assignmentFor() yang bisa menemukan assignment berbeda dari jadwal asli.
    const scheduleId = req.body.scheduleId || null;
    let existing = null;

    if (scheduleId) {
      uuid(scheduleId);
      const { data: byId, error: byIdError } = await db.from('store_schedules')
        .select('id,store_assignment_id,schedule_date,start_time,end_time,shift_number,late_tolerance_minutes,overtime_preapproved,store_assignment:store_assignments!inner(crew_id)')
        .eq('id', scheduleId)
        .single();
      check(byIdError, 'Jadwal tidak ditemukan.');
      if (!byId) throw fail('Jadwal tidak ditemukan.', 404);
      if (byId.store_assignment?.crew_id !== req.body.crewId) throw fail('Jadwal ini bukan milik crew yang dipilih.', 403);
      if (byId.schedule_date !== scheduleDate) throw fail('Tanggal jadwal tidak sesuai.', 422);
      existing = byId;
    } else {
      const { data: byCrew, error: byCrewError } = await db.from('store_schedules')
        .select('id,store_assignment_id,schedule_date,start_time,end_time,shift_number,late_tolerance_minutes,overtime_preapproved,store_assignment:store_assignments!inner(crew_id)')
        .eq('store_assignment.crew_id', req.body.crewId)
        .eq('schedule_date', scheduleDate)
        .limit(2);
      check(byCrewError);
      if ((byCrew || []).length > 1) throw fail('Terdapat jadwal Store ganda pada tanggal ini. Hubungi pengelola database.', 409);
      if (byCrew?.length === 1) {
        existing = byCrew[0];
      } else {
        const assignment = await assignmentFor(req.body.crewId, scheduleDate);
        const payload = { shift_number: selectedShift, store_assignment_id: assignment.id, schedule_date: scheduleDate, start_time: startTime, end_time: endTime, late_tolerance_minutes: tolerance, overtime_preapproved: req.body.overtimePreapproved };
        const { data, error } = await db.from('store_schedules').insert(payload).select().single();
        check(error);
        await logAudit({ actorUserId: req.user.id, action: 'STORE_SCHEDULE_CREATED', entityType: 'store_schedules', entityId: data.id, oldData: null, newData: data });
        return res.status(201).json(data);
      }
    }

    // Update jadwal yang ditemukan
    const { data: attendance, error: attendanceError } = await db.from('attendance_logs').select('id').eq('store_schedule_id', existing.id).limit(1);
    check(attendanceError, 'Pemakaian jadwal tidak dapat diperiksa.');
    if (attendance?.length) throw fail('Jadwal sudah dipakai untuk absensi dan tidak dapat diubah.', 409);
    const updatePayload = { shift_number: selectedShift, start_time: startTime, end_time: endTime, late_tolerance_minutes: tolerance, overtime_preapproved: req.body.overtimePreapproved };
    const { data: saved, error: updateError } = await db.from('store_schedules').update(updatePayload).eq('id', existing.id).select().single();
    check(updateError);
    await logAudit({ actorUserId: req.user.id, action: 'STORE_SCHEDULE_UPDATED', entityType: 'store_schedules', entityId: saved.id, oldData: existing, newData: saved });
    res.status(200).json(saved);
  } catch (error) { next(error); }
});

module.exports = router;
