const router=require('express').Router();
const crypto=require('crypto');
const multer=require('multer');
const sharp=require('sharp');
const db=require('../../config/supabaseClient');
const {uploadPrivateObject}=require('../../utils/signedUrl');
const {s3,BUCKET_NAME}=require('../../config/s3Client');
const {DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {uuid,fail}=require('../crew/crew.validation');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:20,fieldSize:10000}});
// Public guest endpoint: no anonymous read of attendance, photos, phone numbers or schedules.
// Configure a shared edge limiter when deploying multiple backend replicas.
const clients=new Map();
router.use((req,res,next)=>{
  const now=Date.now();for(const [ip,value]of clients)if(value.until<now)clients.delete(ip);
  if(clients.size>10000)return res.status(503).json({message:'Layanan sedang sibuk. Coba lagi.'});
  const key=req.ip;const item=clients.get(key)||{until:now+60000,count:0};item.count++;clients.set(key,item);
  if(item.count>60)return res.status(429).json({message:'Terlalu banyak permintaan. Tunggu satu menit.'});next();
});
router.get('/options',async(req,res,next)=>{
  try {
    const [{data:stores,error:a},{data:events,error:b}]=await Promise.all([
      db.from('stores').select('id,name').eq('status','ACTIVE').order('name'),
      db.from('events').select('id,event_name,event_date').in('status',['SCHEDULED','ONGOING']).order('event_date')
    ]);
    if(a||b)throw fail('Pilihan lokasi belum dapat dimuat.',503);
    res.json({stores,events});
  }catch(error){next(error);}
});
function string(body,key,max,required=false) {
  if(typeof body[key]!=='string'||body[key].length>max||(required&&!body[key].trim()))throw fail(`${key} tidak valid.`);
  return body[key].trim();
}
async function save(req,res,next,legacy=false) {
  let key=null;
  try {
    const b=req.body;
    const full_name=string(b,'fullName',150,true),phone=string(b,'phone',30,true),position=string(b,'position',100),note=string(b,'note',2000),address=string(b,'address',2000);
    if(!/^[+0-9 ()-]{7,30}$/.test(phone))throw fail('Nomor HP tidak valid.');
    if(!['CREW_EVENT','CREW_STORE'].includes(b.crewType)||!['IN','OUT'].includes(b.clockType))throw fail('Jenis absensi tidak valid.');
    if(!req.file||!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype))throw fail('Foto JPG, PNG, atau WebP wajib disertakan (maksimal 5 MB).');
    const latitude=b.latitude===''||b.latitude==null?null:Number(b.latitude),longitude=b.longitude===''||b.longitude==null?null:Number(b.longitude);
    if(!legacy&&(latitude===null||longitude===null||b.locationSource!=='gps'))throw fail('Lokasi GPS perangkat wajib tersedia.');
    if((latitude!==null&&(!Number.isFinite(latitude)||Math.abs(latitude)>90))||(longitude!==null&&(!Number.isFinite(longitude)||Math.abs(longitude)>180)))throw fail('Koordinat tidak valid.');
    const accuracy=b.accuracy===''||b.accuracy==null?null:Number(b.accuracy);
    if(accuracy!==null&&(!Number.isFinite(accuracy)||accuracy<0))throw fail('Akurasi GPS tidak valid.');
    let location_name='Tanpa pilihan event / toko',store_id=null,event_id=null;
    if(legacy)location_name=string(b,'locationName',250,true);
    else if(b.locationId !== undefined && b.locationId !== null && b.locationId !== '') {
      const id=uuid(b.locationId),store=b.crewType==='CREW_STORE';
      const {data,error}=await db.from(store?'stores':'events').select(store?'id,name,status':'id,event_name,status').eq('id',id).maybeSingle();
      if(error)throw fail('Lokasi belum dapat diverifikasi.',503);
      if(!data||!(store?['ACTIVE']:['SCHEDULED','ONGOING']).includes(data.status))throw fail('Pilih lokasi aktif yang tersedia di sistem.');
      location_name=store?data.name:data.event_name;if(store)store_id=id;else event_id=id;
    }
    const occurred_at=legacy?string(b,'occurredAt',40,true):new Date().toISOString();
    if(!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(occurred_at)||!Number.isFinite(Date.parse(occurred_at))||Date.parse(occurred_at)>Date.now()+300000)throw fail('Tanggal/jam absensi tidak valid.');
    const legacy_id=legacy?string(b,'legacyId',80,true):null;
    const import_key=legacy?crypto.createHash('sha256').update(JSON.stringify([legacy_id,full_name,phone,occurred_at,b.clockType,location_name])).update(req.file.buffer).digest('hex'):null;
    const submission_key=legacy?null:uuid(b.submissionKey);
    const findExisting=()=>db.from('guest_attendances').select('id,occurred_at').eq(legacy?'import_key':'submission_key',legacy?import_key:submission_key).maybeSingle();
    const previous=await findExisting();
    if(previous.error)throw fail('Penyimpanan guest belum siap. Jalankan migrasi attendance_review_guest.',503);
    if(previous.data)return res.json(previous.data);
    let photo;
    try{photo=await sharp(req.file.buffer,{limitInputPixels:20000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();}
    catch{throw fail('File foto tidak dapat dibaca.');}
    const id=crypto.randomUUID();key=`guest-attendance/${id}.jpg`;await uploadPrivateObject(key,photo,'image/jpeg');
    const {data,error}=await db.from('guest_attendances').insert({id,import_key,submission_key,legacy_id,full_name,phone,crew_type:b.crewType,store_id,event_id,location_name,position,clock_type:b.clockType,occurred_at,time_source:legacy?'LEGACY_DEVICE':'SERVER',photo_key:key,latitude,longitude,accuracy,address,note}).select('id,occurred_at').single();
    if(error) {
      await s3.send(new DeleteObjectCommand({Bucket:BUCKET_NAME,Key:key})).catch(()=>{});key=null;
      if(error.code==='23505'){const existing=await findExisting();if(existing.data)return res.json(existing.data);}
      throw fail('Absensi belum tersimpan. Coba lagi.',503);
    }
    key=null;res.status(201).json(data);
  }catch(error){if(key)await s3.send(new DeleteObjectCommand({Bucket:BUCKET_NAME,Key:key})).catch(()=>{});next(error);}
}
router.post('/',upload.single('photo'),(req,res,next)=>save(req,res,next,false));
module.exports={router,upload,importGuest:(req,res,next)=>save(req,res,next,true)};
