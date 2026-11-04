const db = require('../../config/supabaseClient');
const {resolveCrewId,validateCoordinates} = require('./attendance.controller');
const {breakWindow} = require('../../utils/workBreak');
const {uuid,fail} = require('../crew/crew.validation');
const {isWithinGeofence} = require('../../utils/geofence');
const {DEFAULT_GEOFENCE_RADIUS_METERS} = require('../../config/constants');
const {compressAttendancePhoto} = require('../../utils/imageCompression');
const {uploadPrivateObject,buildAttendanceKey} = require('../../utils/signedUrl');

// One photo-backed break per open attendance; ownership, GPS and time are
// checked on the server, while conditional updates make retries safe.
async function recordBreak(req,res,next) {
  try {
    const id=uuid(req.params.id),ending=req.params.action==='end';
    if(!['start','end'].includes(req.params.action))throw fail('Aksi istirahat tidak valid.');
    const crewId=await resolveCrewId(req);
    const {lat,lng}=validateCoordinates(req.body.latitude,req.body.longitude);
    if(!req.file)throw fail('Foto langsung dari kamera wajib disertakan.');
    const {data:log,error}=await db.from('attendance_logs').select('id,crew_id,attendance_date,check_in,check_out,break_started_at,break_ended_at,store_schedule_id,event_schedule_id,store_assignment_id,event_assignment_id').eq('id',id).maybeSingle();
    if(error)throw fail('Absensi tidak dapat dibaca.',503);
    if(!log||log.crew_id!==crewId)throw fail('Absensi tidak ditemukan.',404);
    if(!log.check_in||log.check_out)throw fail('Istirahat hanya dapat dicatat setelah Clock In dan sebelum Clock Out.',409);
    if(ending?!log.break_started_at||log.break_ended_at:log.break_started_at)throw fail('Status istirahat sudah berubah. Muat ulang halaman.',409);
    const isStore=!!log.store_schedule_id;
    const {data:schedule,error:scheduleError}=await db.from(isStore?'store_schedules':'event_schedules').select('schedule_date,start_time,end_time,break_start_time,break_end_time').eq('id',isStore?log.store_schedule_id:log.event_schedule_id).maybeSingle();
    if(scheduleError)throw fail('Jadwal istirahat tidak dapat dibaca.',503);
    const window=breakWindow(schedule),now=new Date();
    if(!window)throw fail('Admin belum mengatur istirahat pada shift ini.');
    if(!ending&&(now<window.start||now>=window.shiftEnd))throw fail('Mulai istirahat tersedia sejak jam istirahat hingga sebelum shift berakhir.');
    const {data:assignment,error:assignmentError}=await db.from(isStore?'store_assignments':'event_assignments')
      .select(isStore?'store:stores(latitude,longitude,radius_meters)':'event:events(event_locations(latitude,longitude,radius_meters))')
      .eq('id',isStore?log.store_assignment_id:log.event_assignment_id).maybeSingle();
    if(assignmentError)throw fail('Lokasi penugasan tidak dapat dibaca.',503);
    const location=isStore?assignment?.store:assignment?.event?.event_locations?.[0];
    if(!location)throw fail('Lokasi penugasan tidak ditemukan.');
    const radius=location.radius_meters||DEFAULT_GEOFENCE_RADIUS_METERS;
    const {withinRadius}=isWithinGeofence(lat,lng,location.latitude,location.longitude,radius);
    if(!withinRadius&&req.attendanceLocationMode!=='ANYWHERE')throw fail(`Foto istirahat harus di dalam radius penugasan (${radius} m).`);
    const photo=await compressAttendancePhoto(req.file.buffer),key=buildAttendanceKey(req.user.id);
    await uploadPrivateObject(key,photo,'image/jpeg');
    const prefix=ending?'break_end':'break_start';
    const {data,error:saveError}=await db.from('attendance_logs').update({
      [ending?'break_ended_at':'break_started_at']:new Date().toISOString(),
      [`${prefix}_photo_url`]:key,[`${prefix}_lat`]:lat,[`${prefix}_lng`]:lng,
    }).eq('id',id).eq('crew_id',crewId).is('check_out',null)
      .is(ending?'break_ended_at':'break_started_at',null).select().maybeSingle();
    if(saveError)throw fail('Istirahat gagal disimpan. Muat ulang status absensi sebelum mencoba lagi.',409);
    if(!data)throw fail('Status absensi berubah. Muat ulang halaman.',409);
    res.json(data);
  }catch(error){next(error);}
}
module.exports={recordBreak};
