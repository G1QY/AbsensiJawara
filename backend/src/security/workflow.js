const fail=message=>{throw Object.assign(new Error(message),{status:422});};
const numbers=new Set(['omset_nominal','omset_tunai','omset_transfer','kuota_nominal','kuota_gb','transportasi_pergi_nominal','transportasi_pulang_nominal']);
const fields=new Set(['inventory_before_items','inventory_after_items','tes_print_before_photo','tes_print_after_photo','kuota_nominal_photo','omset_nominal_photo','kuota_provider','kuota_catatan','_currentStep','_maxReached',...numbers]);
for(const direction of ['pergi','pulang'])for(const suffix of ['tanggal','jam','layanan','kendaraan','photo'])fields.add(`transportasi_${direction}_${suffix}`);
function photo(value,eventId){if(typeof value!=='string'||value.length>512||!value.startsWith(`event-workflows/${eventId}/`)||value.includes('..')||!value.endsWith('.jpg'))fail('Referensi foto tidak valid.');}
function validateWorkflowData(data,eventId,existing={}){
 if(!data||typeof data!=='object'||Array.isArray(data))fail('Data workflow tidak valid.');
 for(const [key,value] of Object.entries(data)){
  if(JSON.stringify(existing[key])===JSON.stringify(value))continue;
  const checkpoint=/^(setup_ready|event_finished)_(photo|at|latitude|longitude)_[a-zA-Z0-9-]+$/.test(key);
  if(!fields.has(key)&&!checkpoint)fail('Field workflow tidak diizinkan.');
  if(numbers.has(key)&&(value===''||typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12))fail('Nominal dan kuota wajib angka nonnegatif.');
  if(typeof value==='string'&&value.length>4000)fail('Teks terlalu panjang.');
  if((key.endsWith('_photo')||key.includes('_photo_'))&&value)photo(value,eventId);
  if(key.startsWith('inventory_')){
   if(!Array.isArray(value)||value.length>200)fail('Daftar barang tidak valid.');
   for(const item of value){if(!item||typeof item!=='object'||typeof item.nama!=='string'||item.nama.length>200||!Number.isInteger(item.jumlah)||item.jumlah<0||item.jumlah>1000000)fail('Data barang tidak valid.');for(const k of Object.keys(item))if(!['nama','jumlah','kategori','kondisi','alasan','foto','foto_after'].includes(k))fail('Field barang tidak valid.');if(item.foto)photo(item.foto,eventId);if(item.foto_after)photo(item.foto_after,eventId);}
  }
 }
}
function validateProgress(reached,previous,data,assignmentId,attendance){
 if(reached>previous+1)fail('Langkah workflow tidak boleh dilewati.');
 if(reached<=previous)return;
 const step=reached-1;
 if(step===1&&!attendance.some(a=>a.check_in))fail('Clock In wajib tercatat.');
 if(step===2&&(!data.inventory_before_items?.length||data.inventory_before_items.some(i=>!i.foto)))fail('Foto inventory sebelum wajib tersedia.');
 const evidence={3:'transportasi_pergi_photo',4:`setup_ready_photo_${assignmentId}`,5:'tes_print_before_photo',7:`event_finished_photo_${assignmentId}`,8:'tes_print_after_photo',9:'kuota_nominal_photo',10:'transportasi_pulang_photo',11:'omset_nominal_photo'};
 if(evidence[step]&&!data[evidence[step]])fail('Foto bukti langkah ini wajib tersedia.');
 if(step===12&&(!data.inventory_after_items?.length||data.inventory_after_items.some(i=>!i.foto_after)))fail('Foto inventory setelah wajib tersedia.');
 if(step===14&&!attendance.some(a=>a.check_in&&a.check_out))fail('Clock Out wajib tercatat.');
}
module.exports={validateWorkflowData,validateProgress};
