import {useEffect,useState} from 'react';
import {api} from '../../lib/apiClient';
import {control,button,primary,message} from '../../pages/admin/adminData';

interface Request {id:string;start_date:string;end_date:string;type:string;reason:string;status:string;admin_managed:boolean;review_note?:string;crew?:{user?:{full_name:string}}}
const labels:Record<string,string>={PERMIT:'Izin',SICK:'Sakit',DAY_OFF:'Libur crew',LEAVE:'Cuti',OTHER:'Izin lainnya',PENDING:'Menunggu persetujuan',APPROVED:'Disetujui',REJECTED:'Ditolak'};
export default function PermissionRequests({admin=false,crewId,onChanged}:{admin?:boolean;crewId?:string;onChanged?:()=>void}) {
  const [rows,setRows]=useState<Request[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [form,setForm]=useState({type:'PERMIT',startDate:'',endDate:'',reason:''});
  useEffect(()=>{
    let active=true;setLoading(true);
    const query=admin?`?status=PENDING${crewId?'&crewId='+encodeURIComponent(crewId):''}`:'';
    api.get<Request[]>('/permissions'+query).then(data=>{if(active){setRows(data);setError('');}}).catch(e=>{if(active)setError(message(e));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[admin,crewId,revision]);
  const saved=()=>{setRevision(n=>n+1);onChanged?.();};
  async function review(row:Request,decision:string) {
    setBusy(true);setError('');setNotice('');
    try{await api.patch('/permissions/'+row.id,{decision,note:notes[row.id]||''});setNotice('Keputusan tersimpan. Kalender dan kewajiban hadir mengikuti hasil persetujuan.');saved();}
    catch(e){setError(message(e));}finally{setBusy(false);}
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3" aria-label={admin?'Pengajuan izin dan sakit':'Izin dan sakit saya'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-sm">{admin?'Pengajuan izin & sakit':'Izin & sakit'}</h3><button type="button" className={button+' min-h-11 text-xs'} onClick={()=>{setRevision(n=>n+1);onChanged?.();}} disabled={loading||busy}>Muat ulang</button></div>
    <p className="text-xs leading-relaxed text-slate-600">{admin?'Tinjau pengajuan crew. Status kalender berubah setelah disetujui. Libur crew dapat ditetapkan melalui pengaturan status hari.':'Ajukan izin atau sakit di sini. Status berlaku setelah disetujui Super Admin. Libur crew ditetapkan admin. Konfirmasi WhatsApp dapat dipakai untuk komunikasi tambahan.'}</p>
    {error&&<p role="alert" className="ui-error rounded-xl p-3 text-sm">{error}</p>}
    {notice&&<p role="status" className="ui-success rounded-xl p-3 text-sm">{notice}</p>}
    {!admin&&<button type="button" aria-expanded={expanded} className={primary+' w-full min-h-11'} onClick={()=>setExpanded(v=>!v)}>{expanded?'Tutup formulir':'Ajukan izin / sakit'}</button>}
    {!admin&&expanded&&<form className="space-y-3" onSubmit={async e=>{
      e.preventDefault();setBusy(true);setError('');setNotice('');
      try{await api.post('/permissions',form);setNotice('Pengajuan terkirim dan menunggu persetujuan Super Admin.');setForm({type:'PERMIT',startDate:'',endDate:'',reason:''});setExpanded(false);saved();}catch(e){setError(message(e));}finally{setBusy(false);}
    }}><fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">Jenis pengajuan<select className={control} value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="PERMIT">Izin</option><option value="SICK">Sakit</option></select></label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Tanggal mulai<input type="date" required className={control} value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,endDate:form.endDate<e.target.value?e.target.value:form.endDate})}/></label><label className="text-sm">Tanggal selesai<input type="date" required min={form.startDate} className={control} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label></div>
      <label className="block text-sm">Alasan pengajuan<textarea required minLength={3} maxLength={1000} className={control+' min-h-24 !rounded-xl'} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
      <p className="text-xs text-slate-500">Maksimal 31 hari per pengajuan. Tanggal yang sudah memiliki absensi, izin lain, atau payroll final tidak dapat diajukan.</p>
      <button className={primary+' w-full min-h-11'} disabled={busy}>{busy?'Mengirim...':'Kirim pengajuan'}</button>
    </fieldset></form>}
    {loading?<p className="text-xs text-slate-500">Memuat pengajuan...</p>:!rows.length?<p className="text-xs text-slate-500">{admin?'Tidak ada pengajuan yang menunggu tinjauan.':'Belum ada pengajuan izin/sakit.'}</p>:<div className="space-y-3 max-h-96 overflow-y-auto">{rows.map(row=><article key={row.id} className="rounded-xl bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{admin&&row.crew?.user?.full_name?row.crew.user.full_name+' · ':''}{labels[row.type]||row.type}</strong><span className={row.status==='PENDING'?'text-amber-700':row.status==='APPROVED'?'text-emerald-700':'text-red-700'}>{labels[row.status]||row.status}</span></div>
      <p className="text-xs text-slate-600">{row.start_date}{row.start_date!==row.end_date?' – '+row.end_date:''}{row.admin_managed?' · Ditetapkan admin':''}</p><p className="text-sm whitespace-pre-wrap break-words">{row.reason}</p>
      {row.review_note&&<p className="text-xs text-slate-600">Catatan admin: {row.review_note}</p>}
      {admin&&row.status==='PENDING'&&<><label className="block text-xs">Catatan keputusan<textarea aria-label={'Catatan keputusan '+(row.crew?.user?.full_name||row.id)} maxLength={1000} className={control+' !rounded-xl'} value={notes[row.id]||''} onChange={e=>setNotes({...notes,[row.id]:e.target.value})} placeholder="Wajib diisi jika ditolak"/></label><div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} className={primary+' min-h-11'} onClick={()=>void review(row,'APPROVED')}>Setujui</button><button type="button" disabled={busy||(notes[row.id]||'').trim().length<3} className={button+' min-h-11'} onClick={()=>void review(row,'REJECTED')}>Tolak</button></div></>}
    </article>)}</div>}
  </section>;
}
