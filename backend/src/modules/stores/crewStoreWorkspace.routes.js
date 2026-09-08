const router=require('express').Router();
const db=require('../../config/supabaseClient');
const requireRole=require('../../middlewares/requireRole');
const {ROLES}=require('../../config/constants');

router.use(requireRole(ROLES.CREW_STORE));
const fail=(message,status=422)=>Object.assign(new Error(message),{status});

router.get('/',async(req,res,next)=>{try{
  const {data:crew,error:crewError}=await db.from('crew').select('id,employee_code,base_salary,status,user:users(full_name)').eq('user_id',req.user.id).eq('crew_type','CREW_STORE').maybeSingle();
  if(crewError)throw fail(crewError.message);if(!crew)throw fail('Profil Crew Store tidak ditemukan.',404);
  const workingDate=require('../../utils/attendanceTime').wibDate(new Date());
  const {data:assignment,error:assignmentError}=await db.from('store_assignments').select('id,status,start_date,end_date,store:stores(id,name,status,branch:branches(name))').eq('crew_id',crew.id).eq('status','ACTIVE').lte('start_date',workingDate).or(`end_date.is.null,end_date.gte.${workingDate}`).maybeSingle();
  if(assignmentError)throw fail(assignmentError.message);
  const today=require('../../utils/attendanceTime').wibDate(new Date());const monthStart=today.slice(0,7)+'-01',nextMonth=new Date(today.slice(0,7)+'-01T00:00:00Z');nextMonth.setUTCMonth(nextMonth.getUTCMonth()+1);
  let schedules=[];{const result=await db.from('store_schedules').select('id,schedule_date,start_time,end_time,late_tolerance_minutes,overtime_preapproved,store_assignment:store_assignments!inner(crew_id,status,start_date,end_date)').eq('store_assignment.crew_id',crew.id).gte('schedule_date',monthStart).lt('schedule_date',nextMonth.toISOString().slice(0,10)).order('schedule_date',{ascending:false}).limit(500);if(result.error)throw fail(result.error.message);schedules=(result.data||[]).filter(row=>row.schedule_date<today||(row.store_assignment?.status==='ACTIVE'&&row.store_assignment.start_date<=row.schedule_date&&(!row.store_assignment.end_date||row.store_assignment.end_date>=row.schedule_date))); }
  const {data:attendance,error:attendanceError}=await db.from('attendance_logs').select('id,attendance_date,check_in,check_out,status,review_status,late_minutes,overtime_minutes,overtime_status').eq('crew_id',crew.id).order('attendance_date',{ascending:false}).limit(500);
  if(attendanceError)throw fail(attendanceError.message);
  const {data:permissions,error:permissionError}=await db.from('permissions').select('start_date,end_date,type,status').eq('crew_id',crew.id).eq('status','APPROVED').order('start_date',{ascending:false}).limit(100);
  if(permissionError)throw fail(permissionError.message);
  res.json({crew,assignment,schedules,attendance:attendance||[],permissions:permissions||[]});
}catch(error){next(error);}});

module.exports=router;
