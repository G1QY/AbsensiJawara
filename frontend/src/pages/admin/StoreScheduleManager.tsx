import {submitScheduleRange} from '../../lib/scheduleRange';
import {useEffect,useState,type FormEvent} from 'react';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import {api} from '../../lib/apiClient';
import {button,control,message,primary} from './adminData';

interface Schedule {id:string;schedule_date:string;start_time:string;end_time:string;late_tolerance_minutes:number;overtime_preapproved:boolean}
interface Response {assignment:{id:string;start_date:string;end_date:string|null;store:{name:string}}|null;schedules:Schedule[]}
interface RangeResult {warnings?:string[];created:number;skippedHoliday:number;skippedExisting:number;skippedEvent:number;skippedDay:number}
const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const DAY_OPTIONS=[{value:0,label:'Min'},{value:1,label:'Sen'},{value:2,label:'Sel'},{value:3,label:'Rab'},{value:4,label:'Kam'},{value:5,label:'Jum'},{value:6,label:'Sab'}];
const emptyForm={startDate:'',endDate:'',startTime:'09:00',endTime:'18:00',lateToleranceMinutes:'0',overtimePreapproved:false,workDays:[1,2,3,4,5,6]};

export default function StoreScheduleManager({crewId,crewName}:{crewId:string;crewName:string}){
 const [month,setMonth]=useState(currentMonth()),[data,setData]=useState<Response|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [form,setForm]=useState(emptyForm),[editingDate,setEditingDate]=useState<string|null>(null);
 async function load(){setBusy(true);setError('');try{setData(await api.get<Response>(`/admin-store-schedules/crew/${crewId}?month=${month}`));}catch(e){setError(message(e));}finally{setBusy(false);}}
 useEffect(()=>{void load();},[crewId,month]);
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
   if(editingDate){await api.post('/admin-store-schedules',{crewId,scheduleDate:editingDate,startTime:form.startTime,endTime:form.endTime,lateToleranceMinutes:Number(form.lateToleranceMinutes),overtimePreapproved:form.overtimePreapproved});setNotice(`Jadwal ${editingDate} diperbarui.`);}
   else{const result=await submitScheduleRange(body=>api.post<RangeResult>('/admin-store-schedules/range',body),{crewId,...form,lateToleranceMinutes:Number(form.lateToleranceMinutes)},setNotice);setNotice(`${result.created} jadwal dibuat. ${result.skippedHoliday} tanggal libur, ${result.skippedExisting} jadwal lama, dan ${result.skippedEvent} benturan event dilewati. ${(result.warnings||[]).join(' ')}`);}
   setEditingDate(null);setForm(emptyForm);await load();
 }catch(e){setError(message(e));}finally{setBusy(false);}}
 function edit(s:Schedule){setEditingDate(s.schedule_date);setForm({...emptyForm,startDate:s.schedule_date,endDate:s.schedule_date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),lateToleranceMinutes:String(s.late_tolerance_minutes||0),overtimePreapproved:!!s.overtime_preapproved});}
 function toggleDay(day:number){setForm(previous=>({...previous,workDays:previous.workDays.includes(day)?previous.workDays.filter(value=>value!==day):[...previous.workDays,day].sort()}));}
 return <div className="space-y-5">
  <p className="text-sm text-slate-600">Buat jadwal <strong>{crewName}</strong> untuk satu rentang tanggal. Minggu dapat dipilih sebagai hari kerja; libur nasional, cuti bersama, jadwal lama, dan benturan event dilewati otomatis.</p>
  {error&&<p role="alert" className="ui-error p-3 rounded-xl text-sm">{error}</p>}{notice&&<p role="status" className="ui-success p-3 rounded-xl text-sm">{notice}</p>}
  <label className="block text-xs text-slate-600">Bulan kalender<input aria-label="Bulan jadwal Store" type="month" className={control+' !w-auto'} value={month} onChange={e=>setMonth(e.target.value)}/></label>
  {data&&!data.assignment?<p className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm">Crew belum memiliki penugasan Store aktif pada bulan ini.</p>:data?.assignment&&<p className="text-sm text-slate-700">Store aktif: <strong>{data.assignment.store.name}</strong> • {data.assignment.start_date}{data.assignment.end_date?` sampai ${data.assignment.end_date}`:''}</p>}
  <form onSubmit={save} className="grid sm:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-4">
   <div className="sm:col-span-2 flex items-center justify-between"><strong className="text-sm text-slate-900">{editingDate?`Edit jadwal ${editingDate}`:'Buat jadwal rentang'}</strong>{editingDate?<button type="button" className={button} onClick={()=>{setEditingDate(null);setForm(emptyForm);}}>Batal edit</button>:null}</div>
   <label className="text-xs text-slate-600">Tanggal mulai<input required disabled={!!editingDate} type="date" className={control} value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label>
   <label className="text-xs text-slate-600">Tanggal selesai<input required disabled={!!editingDate} min={form.startDate} type="date" className={control} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
   {!editingDate?<fieldset className="sm:col-span-2"><legend className="text-xs text-slate-600 mb-2">Hari kerja</legend><div className="flex flex-wrap gap-2">{DAY_OPTIONS.map(day=><label key={day.value} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${form.workDays.includes(day.value)?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-500'}`}><input type="checkbox" className="sr-only" checked={form.workDays.includes(day.value)} onChange={()=>toggleDay(day.value)}/>{day.label}</label>)}</div></fieldset>:null}
   <label className="text-xs text-slate-600">Jam masuk<input required type="time" className={control} value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label>
   <label className="text-xs text-slate-600">Jam pulang<input required type="time" className={control} value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label>
   <label className="text-xs text-slate-600 sm:col-span-2">Toleransi telat (menit)<input required type="number" min="0" max="240" className={control} value={form.lateToleranceMinutes} onChange={e=>setForm({...form,lateToleranceMinutes:e.target.value})}/></label>
   <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input aria-label="Setujui lembur dari jadwal" type="checkbox" className="mt-1" checked={form.overtimePreapproved} onChange={e=>setForm({...form,overtimePreapproved:e.target.checked})}/><span><strong>Setujui lembur dari jadwal</strong><small className="block mt-1">Jam penuh setelah jam pulang langsung disetujui. Jika tidak dicentang, lembur menunggu admin.</small></span></label>
   <button disabled={busy||!data?.assignment||(!editingDate&&!form.workDays.length)} className={primary+' sm:col-span-2'}>{busy?'Menyimpan...':editingDate?'Simpan Perubahan':'Buat Jadwal Rentang'}</button>
  </form>
  <AttendanceCalendar crewId={crewId}/>
  <div className="border border-slate-200 rounded-xl overflow-hidden"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="p-3 text-left">Tanggal</th><th className="p-3 text-left">Jam WIB</th><th className="p-3 text-left">Toleransi</th><th className="p-3 text-left">Lembur</th><th className="p-3 text-left">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.schedules.map(s=><tr key={s.id}><td className="p-3">{s.schedule_date}</td><td className="p-3">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</td><td className="p-3">{s.late_tolerance_minutes||0} menit</td><td className="p-3">{s.overtime_preapproved?<span className="text-emerald-700">Disetujui</span>:<span className="text-slate-500">Perlu tinjauan</span>}</td><td className="p-3"><button className={button} type="button" onClick={()=>edit(s)}>Ubah</button></td></tr>)}</tbody></table>{data&&!data.schedules.length&&<p className="p-5 text-sm text-center text-slate-500">Belum ada jadwal pada bulan ini.</p>}</div>
 </div>;
}
