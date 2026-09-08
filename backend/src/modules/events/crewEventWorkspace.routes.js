const {validateWorkflowData,validateProgress}=require('../../security/workflow');
const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const multer = require('multer');
const { compressAttendancePhoto } = require('../../utils/imageCompression');
const { getSignedDownloadUrl, uploadPrivateObject } = require('../../utils/signedUrl');
const { isWithinGeofence } = require('../../utils/geofence');
const { DEFAULT_GEOFENCE_RADIUS_METERS } = require('../../config/constants');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 30, fieldSize: 10000, parts: 31 } });

router.use(requireRole(ROLES.CREW_EVENT));

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function ownCrew(userId) {
  const { data, error } = await db
    .from('crew')
    .select('id, employee_code, base_salary, user:users(full_name)')
    .eq('user_id', userId)
    .eq('crew_type', 'CREW_EVENT')
    .maybeSingle();
  if (error) throw fail(error.message, 422);
  if (!data) throw fail('Profil Crew Event tidak ditemukan.', 404);
  return data;
}

async function ownAssignment(userId, eventId) {
  const crew = await ownCrew(userId);
  const { data, error } = await db
    .from('event_assignments')
    .select('id, event_id, status')
    .eq('crew_id', crew.id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw fail(error.message, 422);
  if (!data) throw fail('Anda tidak ditugaskan pada event ini.', 403);
  return { crew, assignment: data };
}

router.get('/workspace', async (req, res, next) => {
  try {
    const crew = await ownCrew(req.user.id);
    const { data: assignments, error } = await db
      .from('event_assignments')
      .select(`id, position, status,
        event:events!inner(id,event_code,event_name,client_name,event_date,start_time,end_time,pic_crew_id,status,branch:branches(name),event_locations(address),pic:crew!events_pic_crew_id_fkey(user:users(full_name))),
        event_schedules(id,schedule_date,start_time,end_time,status,overtime_preapproved)`)
      .eq('crew_id', crew.id)
      .order('id');
    if (error) throw fail(error.message, 422);

    const eventIds = [...new Set((assignments || []).map(row => row.event?.id).filter(Boolean))];
    const assignmentIds = (assignments || []).map(row => row.id);
    let workflows = [];
    let teamRows = [];
    let attendance = [];
    if (eventIds.length) {
      const [workflowResult, teamResult] = await Promise.all([
        db.from('event_workflows').select('event_id,data,current_step,max_reached,updated_at').in('event_id', eventIds),
        db.from('event_assignments').select('id,event_id,crew_id,position,status,crew:crew(user:users(full_name))').in('event_id', eventIds),
      ]);
      if (workflowResult.error) throw fail(workflowResult.error.message, 422);
      if (teamResult.error) throw fail(teamResult.error.message, 422);
      workflows = workflowResult.data || [];
      teamRows = teamResult.data || [];
    }
    if (assignmentIds.length) {
      const result = await db
        .from('attendance_logs')
        .select('id,event_assignment_id,attendance_date,check_in,check_out,check_in_photo_url,check_out_photo_url,status,review_status,late_minutes,overtime_minutes,overtime_status')
        .in('event_assignment_id', assignmentIds)
        .order('attendance_date', { ascending: false });
      if (result.error) throw fail(result.error.message, 422);
      attendance = result.data || [];
    }

    const workflowByEvent = Object.fromEntries(workflows.map(row => [row.event_id, row]));
    const teamByEvent = teamRows.reduce((all, row) => {
      if(row.status!=='ACTIVE')return all;
      if (!all[row.event_id]) all[row.event_id] = [];
      all[row.event_id].push(row.crew?.user?.full_name || 'Crew');
      return all;
    }, {});
    const attendanceByAssignment = attendance.reduce((all, row) => {
      if (!all[row.event_assignment_id]) all[row.event_assignment_id] = [];
      all[row.event_assignment_id].push(row);
      return all;
    }, {});

    res.json({
      crew,
      assignments: (assignments || []).map(row => ({
        ...row,
        workflow: workflowByEvent[row.event.id] || { event_id: row.event.id, data: {}, current_step: 1, max_reached: 1, updated_at: null },
        team: teamByEvent[row.event.id] || [],
        members:teamRows.filter(member=>member.event_id===row.event.id).map(member=>({id:member.id,crew_id:member.crew_id,name:member.crew?.user?.full_name||'Crew',position:member.position,status:member.status})),
        attendance: attendanceByAssignment[row.id] || [],
      })),
    });
  } catch (error) { next(error); }
});

router.get('/events/:eventId/workflow', async (req, res, next) => {
  try {
    await ownAssignment(req.user.id, req.params.eventId);
    const { data, error } = await db.from('event_workflows')
      .select('event_id,data,current_step,max_reached,updated_at')
      .eq('event_id', req.params.eventId).maybeSingle();
    if (error) throw fail(error.message, 422);
    res.json(data || { event_id: req.params.eventId, data: {}, current_step: 1, max_reached: 1, updated_at: null });
  } catch (error) { next(error); }
});

router.put('/events/:eventId/workflow', async (req, res, next) => {
  try {
    const own = await ownAssignment(req.user.id, req.params.eventId);
    if (!req.body.data || typeof req.body.data !== 'object' || Array.isArray(req.body.data)) throw fail('Data workflow tidak valid.');
    const serialized = JSON.stringify(req.body.data);
    if (serialized.length > 250000) throw fail('Data workflow terlalu besar.', 413);
    const currentStep = Number(req.body.currentStep);
    const maxReached = Number(req.body.maxReached);
    if (!Number.isInteger(currentStep) || currentStep < 1 || currentStep > 15 || !Number.isInteger(maxReached) || maxReached < currentStep || maxReached > 15) {
      throw fail('Progress workflow tidak valid.');
    }
    let saved = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
      const { data: existing, error: existingError } = await db.from('event_workflows')
        .select('data,current_step,max_reached,updated_at')
        .eq('event_id', req.params.eventId)
        .maybeSingle();
      if (existingError) throw fail(existingError.message, 422);
      if (req.body.expectedUpdatedAt !== (existing?.updated_at || null)) throw fail('Data berubah sejak dibuka. Muat ulang sebelum menyimpan.',409);
      validateWorkflowData(req.body.data,req.params.eventId,existing?.data || {});
      for(const [key,value] of Object.entries(req.body.data)){
        if(/^(setup_ready|event_finished)_/.test(key)&&!key.endsWith('_'+own.assignment.id)&&JSON.stringify(value)!==JSON.stringify(existing?.data?.[key]))throw fail('Foto absensi anggota lain tidak boleh diubah.',403);
      }
      const attendanceResult=await db.from('attendance_logs').select('check_in,check_out').eq('event_assignment_id',own.assignment.id);
      if(attendanceResult.error)throw fail('Absensi tidak dapat diverifikasi.',503);
      validateProgress(maxReached,existing?.max_reached || 1,{...(existing?.data||{}),...req.body.data},own.assignment.id,attendanceResult.data||[]);


      const sharedCurrentStep = Math.max(Number(existing?.current_step) || 1, currentStep);
      const payload = {
        event_id: req.params.eventId,
        data: { ...(existing?.data || {}), ...req.body.data },
        current_step: sharedCurrentStep,
        max_reached: Math.max(Number(existing?.max_reached) || 1, maxReached, sharedCurrentStep),
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
      };

      if (!existing) {
        const created = await db.from('event_workflows').insert(payload).select('event_id,data,current_step,max_reached,updated_at').maybeSingle();
        if (created.error && created.error.code !== '23505') throw fail(created.error.message, 422);
        saved = created.data;
      } else {
        const updated = await db.from('event_workflows').update(payload)
          .eq('event_id', req.params.eventId)
          .eq('updated_at', existing.updated_at)
          .select('event_id,data,current_step,max_reached,updated_at')
          .maybeSingle();
        if (updated.error) throw fail(updated.error.message, 422);
        saved = updated.data;
      }
    }
    if (!saved) throw fail('Workflow baru saja diperbarui anggota lain. Muat ulang dan simpan kembali.', 409);
    if (saved.max_reached >= 15) {
      const [eventResult, assignmentResult] = await Promise.all([
        db.from('events').update({ status: 'COMPLETED' }).eq('id', req.params.eventId).neq('status', 'CANCELLED'),
        db.from('event_assignments').update({ status: 'ENDED' }).eq('event_id', req.params.eventId).eq('status', 'ACTIVE'),
      ]);
      if (eventResult.error) throw fail(`Workflow tersimpan, tetapi status event gagal diperbarui: ${eventResult.error.message}`, 422);
      if (assignmentResult.error) throw fail(`Workflow tersimpan, tetapi status penugasan gagal diperbarui: ${assignmentResult.error.message}`, 422);
    }
    res.json(saved);
  } catch (error) { next(error); }
});

router.post('/events/:eventId/photos', upload.single('photo'), async (req, res, next) => {
  try {
    await ownAssignment(req.user.id, req.params.eventId);
    if (!req.file || !['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)) throw fail('Foto JPG, PNG, atau WebP wajib dipilih.', 422);
    const body = await compressAttendancePhoto(req.file.buffer);
    const key = `event-workflows/${req.params.eventId}/${req.user.id}_${Date.now()}.jpg`;
    await uploadPrivateObject(key, body, 'image/jpeg');
    res.status(201).json({ key, url: await getSignedDownloadUrl(key) });
  } catch (error) { next(error); }
});

router.post('/events/:eventId/checkpoints/:checkpoint', upload.single('photo'), async (req, res, next) => {
  try {
    await ownAssignment(req.user.id, req.params.eventId);
    const checkpoint = String(req.params.checkpoint || '').toUpperCase();
    if (!['SETUP_READY', 'EVENT_FINISHED'].includes(checkpoint)) throw fail('Jenis foto checkpoint tidak valid.', 422);
    if (!req.file || !['image/jpeg','image/png','image/webp'].includes(req.file.mimetype)) throw fail('Foto kamera JPG, PNG, atau WebP wajib tersedia.', 422);
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw fail('Koordinat GPS tidak valid.', 422);

    const { data: location, error: locationError } = await db.from('event_locations')
      .select('latitude,longitude,radius_meters,address').eq('event_id', req.params.eventId).maybeSingle();
    if (locationError || !location) throw fail('Lokasi event belum tersedia.', 422);
    const radius = Number(location.radius_meters) || DEFAULT_GEOFENCE_RADIUS_METERS;
    const distance = isWithinGeofence(latitude, longitude, location.latitude, location.longitude, radius);
    if (!distance.withinRadius) throw fail(`Anda berada ${distance.distanceMeters}m dari lokasi event. Batas foto ${radius}m.`, 422);

    const body = await compressAttendancePhoto(req.file.buffer);
    const key = `event-workflows/${req.params.eventId}/${req.user.id}_${Date.now()}_${checkpoint.toLowerCase()}.jpg`;
    await uploadPrivateObject(key, body, 'image/jpeg');
    res.status(201).json({ key, url: await getSignedDownloadUrl(key), capturedAt: new Date().toISOString(), latitude, longitude, distanceMeters: distance.distanceMeters, checkpoint });
  } catch (error) { next(error); }
});

router.get('/events/:eventId/photos/url', async (req, res, next) => {
  try {
    const own = await ownAssignment(req.user.id, req.params.eventId);
    const key = String(req.query.key || '');
    if (!key.startsWith(`event-workflows/${req.params.eventId}/`)) {
      const { data, error } = await db.from('attendance_logs')
        .select('check_in_photo_url,check_out_photo_url').eq('event_assignment_id', own.assignment.id);
      if (error) throw fail('Foto absensi tidak dapat diperiksa.', 422);
      const allowed = new Set((data || []).flatMap(row => [row.check_in_photo_url, row.check_out_photo_url]).filter(Boolean));
      if (!allowed.has(key)) throw fail('Lokasi foto tidak valid.', 422);
    }
    res.json({ url: await getSignedDownloadUrl(key) });
  } catch (error) { next(error); }
});

module.exports = router;
