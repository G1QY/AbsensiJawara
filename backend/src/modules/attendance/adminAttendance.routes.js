const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const { uuid, fail } = require('../crew/crew.validation');
const { getSignedDownloadUrl } = require('../../utils/signedUrl');
const { importGuest, upload } = require('./guestAttendance.routes');
router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER));
const selection = `*, crew:crew(employee_code,user:users(full_name,email,phone_number)),
  store_assignment:store_assignments(store:stores(name)),event_assignment:event_assignments(event:events(event_name)),
  store_schedule:store_schedules(schedule_date,start_time,end_time,late_tolerance_minutes,overtime_preapproved),event_schedule:event_schedules(schedule_date,start_time,end_time,overtime_preapproved)`;
function check(error) {
  if (error) throw fail(error.code?.startsWith('PGRST') || ['42703','42P01'].includes(error.code)
    ? 'Jalankan migrasi attendance_review_guest sebelum membuka absensi.' : error.message, 503);
}
async function all(table,select,order) {
  const rows=[];
  for(let offset=0;;offset+=500) {
    const {data,error}=await db.from(table).select(select).order(order,{ascending:false}).order('id').range(offset,offset+499);
    check(error); rows.push(...data); if(data.length<500)return rows;
  }
}
function hideKeys(row) {
  const {check_in_photo_url,check_out_photo_url,photo_key,...rest}=row;
  return {...rest,hasInPhoto:!!(row.check_in&&check_in_photo_url),hasOutPhoto:!!(row.check_out&&check_out_photo_url),hasPhoto:!!photo_key};
}
router.get('/',async(req,res,next)=>{
  try {
    const [registered,guest]=await Promise.all([all('attendance_logs',selection,'attendance_date'),all('guest_attendances','*','occurred_at')]);
    res.json({registered:registered.map(hideKeys),guest:guest.map(hideKeys)});
  }catch(error){next(error);}
});
router.post('/import-guest',upload.single('photo'),importGuest);
router.get('/:kind/:id',async(req,res,next)=>{
  try {
    uuid(req.params.id);const kind=req.params.kind;
    if(!['registered','guest'].includes(kind))throw fail('Sumber absensi tidak valid.');
    const {data,error}=await db.from(kind==='guest'?'guest_attendances':'attendance_logs').select(kind==='guest'?'*':selection).eq('id',req.params.id).maybeSingle();
    check(error);if(!data)throw fail('Absensi tidak ditemukan.',404);
    const sign=key=>typeof key==='string'&&/^(attendance|guest-attendance)\/[a-zA-Z0-9_./-]+$/.test(key)&&!key.includes('..')?getSignedDownloadUrl(key,600):Promise.resolve('');
    const photoIn=kind==='guest'?(data.clock_type==='IN'?data.photo_key:null):(data.check_in?data.check_in_photo_url:null);
    const photoOut=kind==='guest'?(data.clock_type==='OUT'?data.photo_key:null):(data.check_out?data.check_out_photo_url:null);
    const [inPhoto,outPhoto]=await Promise.all([sign(photoIn),sign(photoOut)]);
    res.json({...hideKeys(data),inPhoto,outPhoto});
  }catch(error){next(error);}
});
router.patch('/:kind/:id/review',async(req,res,next)=>{
  try {
    uuid(req.params.id);const {decision,target,note=''}=req.body;
    if(!['registered','guest'].includes(req.params.kind)||!['APPROVED','REJECTED'].includes(decision)||!['attendance','overtime'].includes(target)||typeof note!=='string'||note.length>2000)throw fail('Data keputusan tidak valid.');
    if(decision==='REJECTED'&&!note.trim())throw fail('Alasan penolakan wajib diisi.');
    const {error}=await db.rpc('review_attendance',{p_actor:req.user.id,p_kind:req.params.kind,p_id:req.params.id,p_target:target,p_decision:decision,p_note:note.trim()});
    if(error)throw fail(error.message,error.code==='40001'?409:error.code==='P0002'?404:error.code==='42501'?403:422);
    res.json({message:'Keputusan tersimpan di server.'});
  }catch(error){next(error);}
});
module.exports=router;
