// Attendance engine — flow final sesuai REPORT_PROGRESS 25 Agustus 2026
// (Section 8-14): NOT_STARTED -> Clock In (GPS+geofence+selfie+server time)
// -> WORKING -> Clock Out (GPS+geofence+selfie+server time, hitung durasi
// & eligibility lembur) -> COMPLETED -> masuk Riwayat & Kalender.
//
// PENTING: aturan potongan telat & nominal lembur BELUM final (menunggu
// keputusan perusahaan — lihat Section 18). Kode ini HANYA menghitung
// `late_minutes` dan `overtime_minutes`/`overtime_status` mentah sesuai
// aturan sementara di Section 11 & 13. Jangan hitung potongan/bonus Rupiah
// di sini sampai ada keputusan resmi.

const supabase = require('../../config/supabaseClient');
const { isWithinGeofence } = require('../../utils/geofence');
const { compressAttendancePhoto } = require('../../utils/imageCompression');
const { uploadPrivateObject, buildAttendanceKey } = require('../../utils/signedUrl');
const { DEFAULT_GEOFENCE_RADIUS_METERS, ROLES } = require('../../config/constants');

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER];
const { wibDate, combineDateTime, scheduledEnd, overtimeMinutes: calculateOvertime, lateMinutes: calculateLate } = require('../../utils/attendanceTime');
const { uuid } = require('../crew/crew.validation');
const { ensureHolidayYears } = require('../../services/nationalHolidaySync');
function attendanceNote(body) {
  const note = body.note ?? body.catatan ?? '';
  if (typeof note !== 'string' || note.length > 2000) throw Object.assign(new Error('Catatan maksimal 2000 karakter.'), { status: 422 });
  return note.trim();
}

async function resolveCrewId(req, requestedCrewId) {
  if (ADMIN_ROLES.includes(req.role) && requestedCrewId) return requestedCrewId;
  const { data, error } = await supabase.from('crew').select('id').eq('user_id', req.user.id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 503 });
  if (!data) throw Object.assign(new Error('Profil crew tidak ditemukan untuk akun ini.'), { status: 404 });
  if (requestedCrewId && requestedCrewId !== data.id) {
    throw Object.assign(new Error('Anda tidak dapat mencatat absensi untuk crew lain.'), { status: 403 });
  }
  return data.id;
}

function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw Object.assign(new Error('Koordinat GPS tidak valid.'), { status: 422 });
  }
  return { lat, lng };
}

function diffMinutes(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
}

// POST /attendance/check-in
// body: { crewId, storeAssignmentId?, storeScheduleId?, eventAssignmentId?, eventScheduleId?, latitude, longitude }
async function checkIn(req, res, next) {
  try {
    const note = attendanceNote(req.body);
    const { crewId, storeAssignmentId, storeScheduleId, eventAssignmentId, eventScheduleId, latitude, longitude } = req.body;
    const effectiveCrewId = await resolveCrewId(req, crewId);
    const { lat, lng } = validateCoordinates(latitude, longitude);

    if (!storeAssignmentId && !eventAssignmentId) {
      const err = new Error('Wajib menyertakan storeAssignmentId ATAU eventAssignmentId.');
      err.status = 422;
      throw err;
    }
    if (!req.file) {
      const err = new Error('Foto live-capture wajib disertakan.');
      err.status = 422;
      throw err;
    }

    // 1) Ambil lokasi referensi (geofence) DAN jadwal (untuk hitung telat)
    let refLocation;
    let schedule = null; // { start_time, end_time, late_tolerance_minutes? }

    if (storeAssignmentId) {
      const { data, error: assignmentError } = await supabase
        .from('store_assignments')
        .select('crew_id, status, start_date, end_date, store:stores(status, latitude, longitude, radius_meters)')
        .eq('id', storeAssignmentId)
        .single();
      if (assignmentError) throw Object.assign(new Error('Penugasan toko tidak ditemukan atau tidak dapat dibaca.'), { status: 422 });
      if (data?.crew_id !== effectiveCrewId) throw Object.assign(new Error('Penugasan toko tidak dimiliki crew ini.'), { status: 403 });
      const workingDate = wibDate(new Date());
      if (data.status !== 'ACTIVE' || data.store?.status !== 'ACTIVE' || data.start_date > workingDate || (data.end_date && data.end_date < workingDate)) {
        throw Object.assign(new Error('Penugasan atau store tidak aktif pada tanggal ini.'), { status: 422 });
      }
      refLocation = data?.store;

      if (storeScheduleId) {
        const { data: sch, error: scheduleError } = await supabase
          .from('store_schedules')
          .select('schedule_date, start_time, end_time, late_tolerance_minutes')
          .eq('id', storeScheduleId)
          .eq('store_assignment_id', storeAssignmentId)
          .single();
        if (scheduleError) throw Object.assign(new Error('Jadwal Store tidak sesuai dengan penugasan crew.'), { status: 422 });
        schedule = sch;
      }
    } else {
      const { data, error: assignmentError } = await supabase
        .from('event_assignments')
        .select('crew_id, status, event:events(id, status, event_locations(latitude, longitude, radius_meters))')
        .eq('id', eventAssignmentId)
        .single();
      if (assignmentError) throw Object.assign(new Error('Penugasan event tidak ditemukan atau tidak dapat dibaca.'), { status: 422 });
      if (data?.crew_id !== effectiveCrewId) throw Object.assign(new Error('Penugasan event tidak dimiliki crew ini.'), { status: 403 });
      if (data.status !== 'ACTIVE' || !['SCHEDULED','ONGOING'].includes(data.event?.status)) throw Object.assign(new Error('Penugasan atau event tidak aktif.'),{status:422});
      refLocation = data?.event?.event_locations?.[0];

      if (eventScheduleId) {
        const { data: sch, error: scheduleError } = await supabase
          .from('event_schedules')
          .select('schedule_date, start_time, end_time')
          .eq('id', eventScheduleId)
          .eq('event_assignment_id', eventAssignmentId)
          .eq('status','ACTIVE')
          .single();
        if (scheduleError) throw Object.assign(new Error('Jadwal Event tidak sesuai dengan penugasan crew.'), { status: 422 });
        schedule = sch ? { ...sch, late_tolerance_minutes: 0 } : null;
      }
    }

    if ((storeScheduleId || eventScheduleId) && !schedule) throw Object.assign(new Error('Jadwal tidak sesuai dengan penugasan.'), { status: 422 });
    if (!refLocation) {
      const err = new Error('Lokasi referensi (store/event) tidak ditemukan.');
      err.status = 404;
      throw err;
    }

    const checkInTime = new Date();
    if (schedule?.schedule_date !== wibDate(checkInTime)) {
      throw Object.assign(new Error('Clock-in hanya dapat dilakukan pada tanggal jadwal kerja dalam WIB.'), { status: 422 });
    }

    const { data: previous, error: previousError } = await supabase
      .from('attendance_logs')
      .select('id, check_in')
      .eq('crew_id', effectiveCrewId)
      .eq('attendance_date', schedule.schedule_date)
      .maybeSingle();
    if (previousError) throw Object.assign(new Error('Status absensi hari ini tidak dapat diperiksa.'), { status: 503 });
    if (previous?.check_in) throw Object.assign(new Error('Anda sudah melakukan clock-in untuk jadwal hari ini.'), { status: 409 });

    // 2) Validasi jarak GPS
    const radius = refLocation.radius_meters || DEFAULT_GEOFENCE_RADIUS_METERS;
    const { withinRadius, distanceMeters } = isWithinGeofence(
      lat, lng, refLocation.latitude, refLocation.longitude, radius
    );

    if (!withinRadius) {
      return res.status(422).json({
        message: `Anda berada ${distanceMeters}m dari lokasi (maks ${radius}m). Check-in ditolak.`,
        distanceMeters,
      });
    }

    // 3) Kompres foto & siapkan upload ke private storage
    let compressedPhoto, objectKey;
    try {
      compressedPhoto = await compressAttendancePhoto(req.file.buffer);
      objectKey = buildAttendanceKey(req.user.id);
      await uploadPrivateObject(objectKey, compressedPhoto, 'image/jpeg');
    } catch {
      throw Object.assign(new Error('Foto absensi tidak dapat disimpan. Periksa konfigurasi Storage backend.'), { status: 503 });
    }

    // 4) Hitung late_minutes (aturan sementara Section 11 — TANPA toleransi
    //    kecuali eksplisit diset di store_schedules.late_tolerance_minutes;
    //    event_schedules belum punya kolom toleransi, dianggap 0)
    let lateMinutes = 0;
    let status = 'PENDING';

    if (schedule) {
      const scheduledStart = combineDateTime(schedule.schedule_date, schedule.start_time);
      lateMinutes = calculateLate(checkInTime, scheduledStart);
      const tolerance = schedule.late_tolerance_minutes || 0;
      status = lateMinutes > tolerance ? 'LATE' : 'PRESENT';
    } else {
      // Tidak ada schedule terkait — tidak bisa hitung telat, tandai PENDING
      // supaya admin bisa review manual (bukan default PRESENT/LATE yang keliru).
      status = 'PENDING';
    }

    // 5) Simpan attendance_logs dengan server timestamp
    const { data: attendance, error } = await supabase
      .from('attendance_logs')
      .insert({
        crew_id: effectiveCrewId,
        store_assignment_id: storeAssignmentId || null,
        event_assignment_id: eventAssignmentId || null,
        store_schedule_id: storeScheduleId || null,
        event_schedule_id: eventScheduleId || null,
        attendance_date: schedule?.schedule_date || wibDate(checkInTime),
        check_in: checkInTime.toISOString(),
        check_in_lat: lat,
        check_in_lng: lng,
        check_in_distance_m: distanceMeters,
        check_in_photo_url: objectKey,
        status,
        late_minutes: lateMinutes,
        check_in_note: note,
        review_status: status === 'PENDING' ? 'PENDING' : 'NOT_REQUIRED',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw Object.assign(new Error('Clock-in untuk jadwal ini sudah tercatat.'), { status: 409 });
      throw Object.assign(new Error('Clock-in gagal disimpan ke database.'), { status: 503 });
    }

    res.status(201).json(attendance);
  } catch (err) {
    next(err);
  }
}

// POST /attendance/{id}/check-out
async function checkOut(req, res, next) {
  try {
    const note = attendanceNote(req.body);
    const { id } = req.params;
    uuid(id);
    const { latitude, longitude } = req.body;
    const { lat, lng } = validateCoordinates(latitude, longitude);
    const ownCrewId = ADMIN_ROLES.includes(req.role) ? null : await resolveCrewId(req);

    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('crew_id, check_in, check_out, attendance_date, store_assignment_id, event_assignment_id, store_schedule_id, event_schedule_id, crew:crew(user_id)')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return res.status(404).json({ message: 'Data absensi tidak ditemukan.' });
    if (!ADMIN_ROLES.includes(req.role) && existing.crew_id !== ownCrewId) return res.status(403).json({ message: 'Akses ditolak.' });
    if (!existing.check_in) return res.status(422).json({ message: 'Check-out tidak dapat dilakukan sebelum check-in.' });
    if (existing.check_out) return res.status(422).json({ message: 'Sudah melakukan check-out sebelumnya.' });
    if (!req.file) return res.status(422).json({ message: 'Foto live-capture wajib disertakan.' });

    let refLocation = null;
    if (existing.store_assignment_id) {
      const { data } = await supabase
        .from('store_assignments')
        .select('store:stores(latitude, longitude, radius_meters)')
        .eq('id', existing.store_assignment_id)
        .maybeSingle();
      refLocation = data?.store;
    } else if (existing.event_assignment_id) {
      const { data } = await supabase
        .from('event_assignments')
        .select('event:events(event_locations(latitude, longitude, radius_meters))')
        .eq('id', existing.event_assignment_id)
        .maybeSingle();
      refLocation = data?.event?.event_locations?.[0];
    }
    if (!refLocation) return res.status(404).json({ message: 'Lokasi referensi absensi tidak ditemukan.' });

    const radius = refLocation.radius_meters || DEFAULT_GEOFENCE_RADIUS_METERS;
    const { withinRadius, distanceMeters } = isWithinGeofence(lat, lng, refLocation.latitude, refLocation.longitude, radius);
    if (!withinRadius) {
      return res.status(422).json({
        message: `Anda berada ${distanceMeters}m dari lokasi (maks ${radius}m). Check-out ditolak.`,
        distanceMeters,
      });
    }

    const compressedPhoto = await compressAttendancePhoto(req.file.buffer);
    const photoKey = buildAttendanceKey(req.user.id);
    await uploadPrivateObject(photoKey, compressedPhoto, 'image/jpeg');

    const checkOutTime = new Date();

    // Hitung eligibility lembur (aturan sementara Section 12 & 13:
    // Clock Out > jadwal selesai TIDAK otomatis lembur — harus mencapai
    // JAM PENUH baru dihitung, dan hasilnya PENDING approval, bukan langsung
    // disetujui/dibayar).
    let overtimeMinutes = 0;
    let overtimeStatus = 'NONE';

    let scheduleEnd = null;
    let overtimePreapproved = false;
    if (existing.store_schedule_id) {
      const { data: sch } = await supabase.from('store_schedules').select('schedule_date,start_time,end_time,overtime_preapproved').eq('id', existing.store_schedule_id).single();
      if (sch) { scheduleEnd = scheduledEnd(sch); overtimePreapproved = !!sch.overtime_preapproved; }
    } else if (existing.event_schedule_id) {
      const { data: sch } = await supabase.from('event_schedules').select('schedule_date,start_time,end_time,overtime_preapproved').eq('id', existing.event_schedule_id).single();
      if (sch) { scheduleEnd = scheduledEnd(sch); overtimePreapproved = !!sch.overtime_preapproved; }
    }

    if (scheduleEnd) {
      overtimeMinutes = calculateOvertime(checkOutTime, scheduleEnd);
      overtimeStatus = overtimeMinutes > 0 ? (overtimePreapproved ? 'APPROVED' : 'PENDING') : 'NONE';
    }

    const { data, error } = await supabase
      .from('attendance_logs')
      .update({
        check_out: checkOutTime.toISOString(),
        check_out_lat: lat,
        check_out_lng: lng,
        check_out_distance_m: distanceMeters,
        check_out_photo_url: photoKey,
        overtime_minutes: overtimeMinutes,
        overtime_status: overtimeStatus,
        check_out_note: note,
      })
      .eq('id', id)
      .is('check_out', null)
      .select()
      .maybeSingle();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(409).json({ message: 'Clock-out sudah tercatat dari halaman lain.' });

    if (overtimeMinutes > 0 && existing.crew?.user_id) {
      const hours = Math.floor(overtimeMinutes / 60);
      const approved = overtimeStatus === 'APPROVED';
      const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: existing.crew.user_id,
        type: approved ? 'OVERTIME_SCHEDULE_APPROVED' : 'OVERTIME_REVIEW_PENDING',
        title: approved ? 'Lembur disetujui dari jadwal' : 'Lembur menunggu persetujuan',
        body: approved
          ? `${hours} jam lembur pada ${existing.attendance_date} telah disetujui sesuai jadwal.`
          : `${hours} jam tambahan pada ${existing.attendance_date} belum menjadi bonus sampai disetujui admin.`,
      });
      if (notificationError) console.error('Notification insert failed after clock-out:', notificationError.message);
    }

    const durationMinutes = diffMinutes(checkOutTime, new Date(existing.check_in));
    res.json({ ...data, durationMinutes });
  } catch (err) {
    next(err);
  }
}

// GET /attendance
async function list(req, res, next) {
  try {
    const { crewId, from, to } = req.query;
    let query = supabase.from('attendance_logs').select(`*, crew:crew(employee_code, user:users(full_name)),
      store_schedule:store_schedules(schedule_date,start_time,end_time,overtime_preapproved),
      event_schedule:event_schedules(schedule_date,start_time,end_time,overtime_preapproved),
      store_assignment:store_assignments(store:stores(name)),
      event_assignment:event_assignments(event:events(event_name))`);

    const effectiveCrewId = ADMIN_ROLES.includes(req.role) ? crewId : await resolveCrewId(req, crewId);
    if (effectiveCrewId) query = query.eq('crew_id', effectiveCrewId);
    if (from) query = query.gte('attendance_date', from);
    if (to) query = query.lte('attendance_date', to);

    const { data, error } = await query.order('attendance_date', { ascending: false });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /attendance/:id
async function getOne(req, res, next) {
  try {
    uuid(req.params.id);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*, crew:crew(employee_code, user:users(full_name))')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    if (!ADMIN_ROLES.includes(req.role)) {
      const ownCrewId = await resolveCrewId(req);
      if (data.crew_id !== ownCrewId) return res.status(403).json({ message: 'Akses ditolak.' });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}

// PATCH /attendance/:id
async function update(req, res, next) {
  try {
    uuid(req.params.id);
    if (!ADMIN_ROLES.includes(req.role)) return res.status(403).json({ message: 'Hanya admin yang dapat mengubah data absensi.' });
    return res.status(422).json({ message: 'Gunakan endpoint tinjauan absensi atau pengajuan koreksi. Status kehadiran tidak boleh diubah menjadi keputusan persetujuan.' });
  } catch (err) {
    next(err);
  }
}

// GET /attendance/calendar?month=YYYY-MM&crewId=<opsional, khusus admin>
//
// Mengembalikan gabungan jadwal (store_schedules + event_schedules) dan
// attendance_logs pada bulan tsb untuk 1 crew, dioverride status
// SICK/PERMISSION kalau ada permissions yang disetujui pada tanggal itu.
//
// Hanya libur nasional/cuti bersama dari kalender Google yang dikembalikan sebagai HOLIDAY.
// Minggu tetap dapat menjadi hari kerja jika memiliki jadwal.
async function calendar(req, res, next) {
  try {
    const { month } = req.query; // format 'YYYY-MM'
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(422).json({ message: 'Parameter month wajib format YYYY-MM.' });
    }

    let crewId = req.query.crewId;
    if (!crewId || !ADMIN_ROLES.includes(req.role)) {
      const { data: ownCrew } = await supabase.from('crew').select('id').eq('user_id', req.user.id).maybeSingle();
      if (!ownCrew) return res.status(404).json({ message: 'Profil crew tidak ditemukan untuk akun ini.' });
      crewId = ownCrew.id;
    }

    const monthStart = `${month}-01`;
    const monthEndDate = new Date(`${month}-01T00:00:00`);
    monthEndDate.setMonth(monthEndDate.getMonth() + 1);
    const monthEnd = monthEndDate.toISOString().slice(0, 10);

    // Jadwal Store: lewat store_assignments crew ini
    const { data: storeSchedules } = await supabase
      .from('store_schedules')
      .select('id, schedule_date, start_time, end_time, overtime_preapproved, store_assignment:store_assignments!inner(crew_id,status,start_date,end_date,store:stores(name))')
      .eq('store_assignment.crew_id', crewId)
      .gte('schedule_date', monthStart)
      .lt('schedule_date', monthEnd);

    // Jadwal Event: lewat event_assignments crew ini
    const { data: eventSchedules } = await supabase
      .from('event_schedules')
      .select('id, schedule_date, start_time, end_time, overtime_preapproved,status, event_assignment:event_assignments!inner(crew_id,status,event:events(event_name,status))')
      .eq('event_assignment.crew_id', crewId)
      .gte('schedule_date', monthStart)
      .lt('schedule_date', monthEnd);

    // Attendance sebulan ini
    const { data: attendanceRows } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('crew_id', crewId)
      .gte('attendance_date', monthStart)
      .lt('attendance_date', monthEnd);

    // Permission (SICK/PERMISSION) yang approved, overlap bulan ini
    const { data: approvedPermissions } = await supabase
      .from('permissions')
      .select('start_date, end_date, type')
      .eq('crew_id', crewId)
      .eq('status', 'APPROVED')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart);

    const calendarResults=await ensureHolidayYears([monthStart.slice(0, 4)]);
    const { data: holidays, error: holidayError } = await supabase
      .from('national_holidays')
      .select('holiday_date,name,kind')
      .gte('holiday_date', monthStart)
      .lt('holiday_date', monthEnd);
    if (holidayError) throw Object.assign(new Error('Kalender libur nasional belum siap. Jalankan migrasi kalender kerja.'), { status: 503 });

    const today = wibDate(new Date());

    const buildDay = (scheduleDate, startTime, endTime, sourceType, sourceName, overtimePreapproved, scheduleId) => {
      const attendance = attendanceRows?.find(a => sourceType==='STORE'?a.store_schedule_id===scheduleId:a.event_schedule_id===scheduleId);
      const permission = approvedPermissions?.find(p => scheduleDate >= p.start_date && scheduleDate <= p.end_date);

      let status;
      if (permission) status = permission.type === 'SICK' ? 'SICK' : 'PERMISSION';
      else if (attendance) status = attendance.status;
      else if (scheduleDate < today) status = 'ABSENT';
      else status = 'PENDING';

      return {
        date: scheduleDate,
        type: sourceType,
        source: sourceName,
        startTime,
        endTime,
        status,
        checkIn: attendance?.check_in ?? null,
        checkOut: attendance?.check_out ?? null,
        lateMinutes: attendance?.late_minutes ?? 0,
        overtimeMinutes: attendance?.overtime_minutes ?? 0,
        overtimeStatus: attendance?.overtime_status ?? 'NONE',
        overtimePreapproved: !!overtimePreapproved,
      };
    };

    const scheduledDays = [
      ...(storeSchedules || []).filter(s=>attendanceRows?.some(a=>a.store_schedule_id===s.id)||(s.schedule_date<today)||(s.store_assignment?.status==='ACTIVE'&&s.store_assignment.start_date<=s.schedule_date&&(!s.store_assignment.end_date||s.store_assignment.end_date>=s.schedule_date))).map(s => buildDay(s.schedule_date, s.start_time, s.end_time, 'STORE', s.store_assignment?.store?.name, s.overtime_preapproved,s.id)),
      ...(eventSchedules || []).filter(s=>attendanceRows?.some(a=>a.event_schedule_id===s.id)||(s.schedule_date<today)||(s.status==='ACTIVE'&&s.event_assignment?.status==='ACTIVE'&&['SCHEDULED','ONGOING'].includes(s.event_assignment?.event?.status))).map(s => buildDay(s.schedule_date, s.start_time, s.end_time, 'EVENT', s.event_assignment?.event?.event_name, s.overtime_preapproved,s.id)),
    ];
    const dayByDate = new Map(scheduledDays.map(day => [day.date, day]));
    const holidayByDate = new Map((holidays || []).map(row => [row.holiday_date, row]));
    for (let value = new Date(`${monthStart}T00:00:00Z`); value < new Date(`${monthEnd}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1)) {
      const dateValue = value.toISOString().slice(0, 10);
      if (dayByDate.has(dateValue)) continue;
      const holiday = holidayByDate.get(dateValue);
      if (!holiday) continue;
      dayByDate.set(dateValue, {
        date: dateValue,
        type: 'HOLIDAY',
        source: holiday.name,
        holidayKind: holiday.kind,
        startTime: null,
        endTime: null,
        status: 'HOLIDAY',
        checkIn: null,
        checkOut: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        overtimeStatus: 'NONE',
        overtimePreapproved: false,
      });
    }
    const days = [...dayByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    res.json({ month, crewId, days, warnings:calendarResults.filter(row=>row.warning).map(row=>row.warning) });
  } catch (err) {
    next(err);
  }
}

// GET /attendance/today — dipakai halaman Absensi Crew Store & Crew Event
// untuk tahu: apakah hari ini ada jadwal, sudah check-in belum, dan
// id-id (assignment/schedule) yang dibutuhkan untuk memanggil check-in/out.
async function today(req, res, next) {
  try {
    const { data: crew, error: crewError } = await supabase.from('crew').select('id, crew_type, status').eq('user_id', req.user.id).maybeSingle();
    if (crewError) throw Object.assign(new Error('Profil crew tidak dapat dimuat.'), { status: 503 });
    if (!crew) return res.status(404).json({ message: 'Profil crew tidak ditemukan untuk akun ini.' });
    if (crew.status !== 'ACTIVE') return res.status(403).json({ message: 'Akun crew tidak aktif.' });

    const todayStr = wibDate(new Date());

    const {data:open,error:openError}=await supabase.from('attendance_logs')
      .select('id,check_in,check_out,status,review_status,late_minutes,overtime_minutes,overtime_status,store_assignment_id,event_assignment_id,store_schedule_id,event_schedule_id,store_schedule:store_schedules(start_time,end_time,overtime_preapproved),event_schedule:event_schedules(start_time,end_time,overtime_preapproved),store_assignment:store_assignments(store:stores(name)),event_assignment:event_assignments(event:events(id,event_name))')
      .eq('crew_id',crew.id).not('check_in','is',null).is('check_out',null).order('check_in',{ascending:false}).limit(1).maybeSingle();
    if(openError)throw Object.assign(new Error('Absensi yang belum clock out tidak dapat dibaca.'),{status:503});
    if(open){
      const isStore=!!open.store_assignment_id,sch=isStore?open.store_schedule:open.event_schedule;
      if(!sch)throw Object.assign(new Error('Jadwal absensi terbuka tidak ditemukan. Hubungi admin.'),{status:422});
      return res.json({crewId:crew.id,date:todayStr,hasSchedule:true,context:{type:isStore?'STORE':'EVENT',storeAssignmentId:open.store_assignment_id,storeScheduleId:open.store_schedule_id,eventAssignmentId:open.event_assignment_id,eventScheduleId:open.event_schedule_id,eventId:open.event_assignment?.event?.id||null,scheduledStart:sch.start_time,scheduledEnd:sch.end_time,overtimePreapproved:!!sch.overtime_preapproved,locationName:isStore?open.store_assignment?.store?.name:open.event_assignment?.event?.event_name},attendance:open});
    }

    let storeSchedule = null;
    if (crew.crew_type === 'CREW_STORE') {
      const { data, error } = await supabase
        .from('store_schedules')
        .select('id, schedule_date, start_time, end_time, overtime_preapproved, store_assignment:store_assignments!inner(id, crew_id, status, start_date, end_date, store:stores(name,status))')
        .eq('store_assignment.crew_id', crew.id)
        .eq('store_assignment.status','ACTIVE')
        .lte('store_assignment.start_date',todayStr)
        .or(`end_date.is.null,end_date.gte.${todayStr}`,{referencedTable:'store_assignment'})
        .eq('schedule_date', todayStr)
        .maybeSingle();
      if (error) throw Object.assign(new Error('Jadwal Store hari ini tidak dapat dimuat. Pastikan hanya ada satu jadwal aktif.'), { status: 422 });
      const assignment = data?.store_assignment;
      storeSchedule = data && assignment?.status === 'ACTIVE' && assignment?.store?.status === 'ACTIVE'
        && assignment.start_date <= todayStr && (!assignment.end_date || assignment.end_date >= todayStr) ? data : null;
    }

    let context = null;
    if (storeSchedule) {
      context = {
        type: 'STORE',
        storeAssignmentId: storeSchedule.store_assignment.id,
        storeScheduleId: storeSchedule.id,
        eventAssignmentId: null,
        eventScheduleId: null,
        eventId: null,
        scheduledStart: storeSchedule.start_time,
          scheduledEnd: storeSchedule.end_time,
          overtimePreapproved: !!storeSchedule.overtime_preapproved,
        locationName: storeSchedule.store_assignment.store?.name,
      };
    } else if (crew.crew_type === 'CREW_EVENT') {
      const { data: eventSchedule, error: eventScheduleError } = await supabase
        .from('event_schedules')
        .select('id, schedule_date, start_time, end_time, overtime_preapproved, event_assignment:event_assignments!inner(id, crew_id, status, event:events!inner(id,event_name,status))')
        .eq('event_assignment.crew_id', crew.id)
        .eq('event_assignment.status', 'ACTIVE')
        .in('event_assignment.event.status', ['SCHEDULED','ONGOING'])
        .eq('status', 'ACTIVE')
        .eq('schedule_date', todayStr)
        .maybeSingle();

      if(eventScheduleError) throw Object.assign(new Error('Jadwal event tidak dapat dimuat. Pastikan hanya satu jadwal event aktif untuk crew pada tanggal ini.'), {status:422});
      if (eventSchedule) {
        context = {
          type: 'EVENT',
          storeAssignmentId: null,
          storeScheduleId: null,
          eventAssignmentId: eventSchedule.event_assignment.id,
          eventScheduleId: eventSchedule.id,
          eventId: eventSchedule.event_assignment.event?.id,
          scheduledStart: eventSchedule.start_time,
          scheduledEnd: eventSchedule.end_time,
          overtimePreapproved: !!eventSchedule.overtime_preapproved,
          locationName: eventSchedule.event_assignment.event?.event_name,
        };
      }
    }

    let attendance = null;
    if (context) {
      const { data, error: attendanceError } = await supabase
        .from('attendance_logs')
        .select('id, check_in, check_out, status, review_status, late_minutes, overtime_minutes, overtime_status')
        .eq('crew_id', crew.id)
        .eq(context.type==='STORE'?'store_schedule_id':'event_schedule_id',context.type==='STORE'?context.storeScheduleId:context.eventScheduleId)
        .maybeSingle();
      if(attendanceError)throw Object.assign(new Error('Absensi jadwal tidak dapat dibaca.'),{status:422});
      attendance = data;
    }

    res.json({ crewId: crew.id, date: todayStr, hasSchedule: !!context, context, attendance });
  } catch (err) {
    next(err);
  }
}

module.exports = { checkIn, checkOut, list, getOne, update, calendar, today };
