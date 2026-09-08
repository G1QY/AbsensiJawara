const router=require('express').Router();
const db=require('../../config/supabaseClient');
const requireRole=require('../../middlewares/requireRole');
const {uuid,fail}=require('../crew/crew.validation');
const {logAudit}=require('../../utils/auditLogger');
router.use(requireRole('SUPER_ADMIN','ADMIN_STORE','EVENT_MANAGER'));
const select=`*,branch:branches(name),pic:crew!events_pic_crew_id_fkey(user:users(full_name)),event_locations(*),event_assignments(id,crew_id,position,status,crew:crew(id,employee_code,crew_type,base_salary,user:users(full_name,email)),event_schedules(*))`;
function check(error){if(error)throw fail(error.code==='40001'?error.message:error.code==='23505'?'Kode event sudah dipakai.':error.code?.startsWith('PGRST')||error.code==='42703'?'Jalankan migrasi admin_event_workspace terlebih dahulu.':error.message,error.code==='40001'?409:error.code==='42501'?403:422);}
router.get('/',async(req,res,next)=>{try{
  const rows=[];for(let start=0;;start+=500){const {data,error}=await db.from('events').select(select).order('event_date',{ascending:false}).order('id').range(start,start+499);check(error);rows.push(...data);if(data.length<500)break;}
  res.json(rows);
}catch(e){next(e);}});
router.get('/:id',async(req,res,next)=>{try{
  uuid(req.params.id);const {data:event,error}=await db.from('events').select(select).eq('id',req.params.id).maybeSingle();check(error);if(!event)throw fail('Event tidak ditemukan.',404);
  const attendance=[];for(let start=0;;start+=500){const {data,error}=await db.from('attendance_logs').select('id,crew_id,attendance_date,check_in,check_out,check_in_photo_url,check_out_photo_url,status,review_status,late_minutes,overtime_minutes,overtime_status,check_in_note,check_out_note,event_assignment:event_assignments!inner(event_id)').eq('event_assignment.event_id',req.params.id).order('id').range(start,start+499);check(error);attendance.push(...data);if(data.length<500)break;}
  const {data:audit,error:auditError}=await db.from('audit_logs').select('id,action,created_at').eq('entity_type','events').eq('entity_id',req.params.id).order('created_at',{ascending:false}).limit(100);check(auditError);
  const {data:workflow,error:workflowError}=await db.from('event_workflows').select('event_id,data,current_step,max_reached,updated_at').eq('event_id',event.id).maybeSingle();check(workflowError);
  res.json({...event,attendance,audit,workflow:workflow||{event_id:event.id,data:{},current_step:1,max_reached:1,updated_at:null}});
}catch(e){next(e);}});
router.get('/:id/photos/url',async(req,res,next)=>{try{
 uuid(req.params.id);const key=String(req.query.key||'');
 const {data:event,error}=await db.from('events').select('id').eq('id',req.params.id).maybeSingle();check(error);if(!event)throw fail('Event tidak ditemukan.',404);
 if(!key.startsWith(`event-workflows/${event.id}/`)){
 const {data,error}=await db.from('attendance_logs').select('id,event_assignment:event_assignments!inner(event_id)').eq('event_assignment.event_id',event.id).or(`check_in_photo_url.eq.${key.replace(/[^a-zA-Z0-9/_.-]/g,'')},check_out_photo_url.eq.${key.replace(/[^a-zA-Z0-9/_.-]/g,'')}`).limit(1);check(error);
 if(!/^[a-zA-Z0-9/_.-]+$/.test(key)||!data?.length)throw fail('Foto bukan milik event ini.',403);
 }
 res.json({url:await require('../../utils/signedUrl').getSignedDownloadUrl(key)});
}catch(error){next(error);}});
function validate(b){
  uuid(b.branch_id);if(b.pic_crew_id)uuid(b.pic_crew_id);
  for(const [k,max]of [['event_name',150],['event_code',30],['address',1000]])if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>max)throw fail(`${k} wajib diisi.`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.event_date)||!Number.isFinite(Date.parse(b.event_date))||new Date(b.event_date).toISOString().slice(0,10)!==b.event_date)throw fail('Tanggal tidak valid.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end_time)||b.start_time>=b.end_time)throw fail('Jam selesai harus setelah jam mulai pada tanggal yang sama.');
  if(!['DRAFT','SCHEDULED','ONGOING','COMPLETED','CANCELLED'].includes(b.status))throw fail('Status tidak valid.');
  if(typeof b.overtime_preapproved!=='boolean')throw fail('Pilihan persetujuan lembur wajib berupa ya atau tidak.');
  if(typeof b.latitude!=='number'||!Number.isFinite(b.latitude)||Math.abs(b.latitude)>90||typeof b.longitude!=='number'||!Number.isFinite(b.longitude)||Math.abs(b.longitude)>180||!Number.isInteger(b.radius_meters)||b.radius_meters<1||b.radius_meters>10000)throw fail('Koordinat/radius tidak valid.');
  return Object.fromEntries(['event_name','event_code','client_name','branch_id','event_date','start_time','end_time','status','pic_crew_id','address','latitude','longitude','radius_meters','expected_updated_at','overtime_preapproved'].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]));
}
async function save(req,res,next){try{
  if(req.params.id)uuid(req.params.id);const fields=validate(req.body);
  const {data,error}=await db.rpc('save_admin_event',{p_actor:req.user.id,p_id:req.params.id||null,p_data:fields});check(error);
  const {error:overtimeError}=await db.from('events').update({overtime_preapproved:fields.overtime_preapproved}).eq('id',data);
  if(overtimeError)throw fail('Event tersimpan, tetapi pilihan lembur belum tersimpan. Jalankan migrasi crew_overtime_approval_notifications.',503);
  await logAudit({actorUserId:req.user.id,action:'EVENT_OVERTIME_POLICY_SET',entityType:'events',entityId:data,newData:{overtime_preapproved:fields.overtime_preapproved}});
  res.status(req.params.id?200:201).json({id:data});
}catch(e){next(e);}}
router.post('/',save);router.patch('/:id',save);
router.post('/:id/crew',async(req,res,next)=>{try{
  uuid(req.params.id);uuid(req.body.crewId);if(!['ACTIVE','ENDED'].includes(req.body.status)||typeof req.body.position!=='string'||req.body.position.length>50)throw fail('Penugasan tidak valid.');
  const {data,error}=await db.rpc('assign_admin_event',{p_actor:req.user.id,p_event:req.params.id,p_crew:req.body.crewId,p_position:req.body.position,p_status:req.body.status});check(error);res.json({id:data});
}catch(e){next(e);}});
module.exports=router;
