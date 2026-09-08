// Legacy generic CRUD has no ownership or business validation. Mutations must
// use dedicated controllers (admin-events, admin-directory, admin-store-schedules).
const supabase=require('../config/supabaseClient');
function crudFactory(table,{selectQuery='*'}={}){
 async function list(req,res,next){
  if(req.role!=='SUPER_ADMIN')return res.status(403).json({message:'Endpoint lama hanya tersedia untuk Super Admin. Gunakan workspace sesuai role.'});
  try{const {data,error}=await supabase.from(table).select(selectQuery).limit(500);if(error)throw Object.assign(new Error('Data tidak dapat dimuat.'),{status:422});res.json(data);}catch(e){next(e);}
 }
 function disabled(req,res){return res.status(405).json({message:'Penulisan melalui endpoint lama dinonaktifkan. Gunakan endpoint workspace yang tervalidasi.'});}
 return {list,create:disabled,update:disabled};
}
module.exports=crudFactory;
