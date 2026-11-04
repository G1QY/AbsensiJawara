const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const {uuid,fail} = require('../crew/crew.validation');
const personal = requireRole('CREW_STORE','CREW_EVENT','HEAD_STORE','ADMIN_STORE','EVENT_MANAGER','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF');
const validDate = value => typeof value==='string' && /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
function check(error) {
  if(error) throw fail(['23P01','40001','P0001','22023'].includes(error.code)?error.message:'Pengajuan tidak dapat diproses. Pastikan migrasi izin/sakit sudah terpasang.',error.code==='42501'?403:error.code==='P0002'?404:['23P01','40001'].includes(error.code)?409:422);
}
router.get('/',async(req,res,next)=>{
  try {
    let crewId;
    if(req.role==='SUPER_ADMIN') { if(req.query.crewId) crewId=uuid(req.query.crewId); }
    else {
      const {data,error}=await db.from('crew').select('id').eq('user_id',req.user.id).maybeSingle();check(error);
      if(!data) throw fail('Profil crew tidak ditemukan.',403);
      crewId=data.id;
    }
    let query=db.from('permissions').select('id,crew_id,start_date,end_date,type,reason,status,admin_managed,review_note,reviewed_at,created_at,crew:crew(employee_code,user:users(full_name))');
    if(crewId) query=query.eq('crew_id',crewId);
    if(req.query.status){if(!['PENDING','APPROVED','REJECTED'].includes(req.query.status))throw fail('Status tidak valid.');query=query.eq('status',req.query.status);}
    const {data,error}=await query.order('created_at',{ascending:false}).limit(200);check(error);res.json(data||[]);
  }catch(error){next(error);}
});
router.post('/',personal,async(req,res,next)=>{
  try {
    const {startDate,endDate,type,reason}=req.body;
    if(!validDate(startDate)||!validDate(endDate)||startDate>endDate||(Date.parse(endDate)-Date.parse(startDate))/86400000>30||!['PERMIT','SICK'].includes(type)||typeof reason!=='string'||reason.trim().length<3||reason.length>1000) throw fail('Pilih izin/sakit, tanggal maksimal 31 hari, dan isi alasan 3–1000 karakter.');
    const {data,error}=await db.rpc('request_crew_permission',{p_actor:req.user.id,p_start:startDate,p_end:endDate,p_type:type,p_reason:reason.trim()});check(error);
    res.status(201).json({id:data,status:'PENDING'});
  }catch(error){next(error);}
});
router.patch('/:id',requireRole('SUPER_ADMIN'),async(req,res,next)=>{
  try {
    const id=uuid(req.params.id),{decision,note=''}=req.body;
    if(!['APPROVED','REJECTED'].includes(decision)||typeof note!=='string'||note.length>1000||(decision==='REJECTED'&&note.trim().length<3))throw fail('Pilih keputusan dan isi alasan jika ditolak.');
    const {error}=await db.rpc('review_crew_permission',{p_actor:req.user.id,p_id:id,p_decision:decision,p_note:note.trim()});check(error);
    res.json({message:'Keputusan izin/sakit tersimpan.'});
  }catch(error){next(error);}
});

module.exports = router;
