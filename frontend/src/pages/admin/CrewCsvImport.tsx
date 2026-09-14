import {useRef, useState} from 'react';
import Modal from '../../components/ui/Modal';
import {api, ApiError} from '../../lib/apiClient';
import {button, control, primary, message} from './adminData';
import {parseCrewCsv, type ImportCrew} from './crewCsv';
export default function CrewCsvImport({onClose,onSaved,existingEmails}:{onClose:()=>void;onSaved:()=>Promise<void>;existingEmails:string[]}) {
 const [rows,setRows]=useState<ImportCrew[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const running=useRef(false);
 async function read(file?:File){setError('');setNotice('');setRows([]);if(!file)return;try{
  if(file.size>1024*1024)throw new Error('Ukuran CSV maksimal 1 MB.');
  const existing=new Set(existingEmails.map(e=>e.toLowerCase()));
  setRows(parseCrewCsv(await file.text()).map(r=>existing.has(r.email)?{...r,password:'',done:true,result:'Dilewati: akun sudah ada'}:r));
 }catch(e){setError(message(e));}}
 function edit(index:number,patch:Partial<ImportCrew>){setRows(old=>old.map((r,i)=>i===index?{...r,...patch}:r));}
 async function save(){if(running.current)return;running.current=true;setBusy(true);setError('');setNotice('');let success=0;
  try{for(let i=0;i<rows.length;i++){
   const row=rows[i];if(row.done)continue;
   if(!['CREW_STORE','CREW_EVENT'].includes(row.crewType))throw new Error('Pilih jenis penugasan untuk semua akun yang akan diimpor.');
   try{
    await api.post('/crew',{fullName:row.fullName,email:row.email,password:row.password,phoneNumber:row.phoneNumber,companyName:row.companyName,jobTitle:row.jobTitle,crewType:row.crewType,baseSalary:0,status:'ACTIVE',branchId:null,assignTo:null});
    edit(i,{done:true,password:'',result:'Berhasil dibuat'});success++;
   }catch(e){edit(i,{result:message(e)});if(!(e instanceof ApiError)||e.status===429||e.status>=500)break;}
  }
  setNotice(`${success} akun berhasil dibuat pada proses ini. Periksa hasil setiap baris. Akun yang berhasil tidak dikirim ulang.`);
  await onSaved();
 }catch(e){setError(message(e));}finally{running.current=false;setBusy(false);}}
 const pending=rows.filter(r=>!r.done);
 return <Modal open onClose={()=>{if(!busy)onClose()}} title="Impor akun crew dari CSV" size="xl">
  <div className="space-y-4">
   <p className="text-sm text-slate-600">Pilih CSV dari bos, periksa perusahaan dan jabatan, lalu tentukan jenis penugasan. Cabang dan lokasi dapat diatur setelah akun dibuat. Password tidak ditampilkan.</p>
   <label className="block text-sm">File CSV<input type="file" accept=".csv,text/csv" disabled={busy} className="mt-2 block w-full" onChange={e=>void read(e.target.files?.[0])}/></label>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
   {!!rows.length&&<>
    <label className="block text-sm">Terapkan jenis penugasan ke semua akun yang belum diimpor
     <select disabled={busy} className={control} value="" onChange={e=>{const crewType=e.target.value;if(crewType)setRows(old=>old.map(r=>r.done?r:{...r,crewType}));}}>
      <option value="">Pilih jika semua memiliki jenis yang sama</option><option value="CREW_STORE">Crew Store / Kantor</option><option value="CREW_EVENT">Crew Event</option>
     </select>
    </label>
    <div className="max-h-[45dvh] overflow-auto border rounded-xl"><table className="w-full text-sm"><thead><tr>{['Nama / Email','Perusahaan','Jabatan','Jenis Penugasan','Hasil'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>
     {rows.map((r,i)=><tr key={r.email} className="border-t"><td className="p-2">{r.fullName}<span className="block text-xs text-slate-500">{r.email}</span></td>
      <td className="p-2"><input aria-label={`Perusahaan ${r.fullName}`} disabled={busy||r.done} maxLength={150} className={control} value={r.companyName} onChange={e=>edit(i,{companyName:e.target.value})}/></td>
      <td className="p-2"><input aria-label={`Jabatan ${r.fullName}`} disabled={busy||r.done} maxLength={100} className={control} value={r.jobTitle} placeholder="Belum diisi" onChange={e=>edit(i,{jobTitle:e.target.value})}/></td>
      <td className="p-2"><select aria-label={`Jenis penugasan ${r.fullName}`} disabled={busy||r.done} className={control} value={r.crewType} onChange={e=>edit(i,{crewType:e.target.value})}><option value="">Pilih jenis</option><option value="CREW_STORE">Crew Store / Kantor</option><option value="CREW_EVENT">Crew Event</option></select></td>
      <td className="p-2 min-w-36">{r.result||'Belum diimpor'}</td></tr>)}
    </tbody></table></div>
    <p className="text-xs text-slate-500">{rows.length} akun. Gaji awal Rp0. Jabatan yang kosong dapat dilengkapi melalui Edit Crew.</p>
   </>}
   <div className="flex flex-wrap justify-end gap-2"><button disabled={busy} className={button} onClick={onClose}>Tutup</button><button className={primary} disabled={busy||!pending.length||pending.some(r=>!r.crewType)} onClick={()=>void save()}>{busy?'Memproses akun…':`Impor ${pending.length} akun`}</button></div>
  </div>
 </Modal>;
}
