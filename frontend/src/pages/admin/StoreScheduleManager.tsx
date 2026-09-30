import ShiftFields from '../../components/attendance/ShiftFields';
import {t as translateUI} from '../../lib/i18n';
import {submitScheduleRange} from '../../lib/scheduleRange';
import {useEffect,useState,type FormEvent} from 'react';
import AttendanceCalendar, {type CalendarDay} from '../../components/attendance/AttendanceCalendar';
import {api} from '../../lib/apiClient';
import {button,control,message,primary} from './adminData';
import Modal from '../../components/ui/Modal';

interface Schedule {shift_number?:number;id:string;schedule_date:string;start_time:string;end_time:string;late_tolerance_minutes:number;overtime_preapproved:boolean}
interface Response {assignment:{id:string;start_date:string;end_date:string|null;store:{name:string}}|null;schedules:Schedule[]}
interface RangeResult {warnings?:string[];created:number;skippedOverlap?:number;skippedHoliday:number;skippedExisting:number;skippedEvent:number;skippedDay:number}
interface EditScheduleTarget {id?:string|null;schedule_date:string;shift_number:number;start_time:string;end_time:string;late_tolerance_minutes:number;overtime_preapproved:boolean}

const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const DAY_OPTIONS=[{value:0,label:'Min'},{value:1,label:'Sen'},{value:2,label:'Sel'},{value:3,label:'Rab'},{value:4,label:'Kam'},{value:5,label:'Jum'},{value:6,label:'Sab'}];
const emptyForm={startDate:'',endDate:'',shiftNumber:1,startTime:'09:00',endTime:'18:00',lateToleranceMinutes:'0',overtimePreapproved:false,workDays:[1,2,3,4,5,6]};

export default function StoreScheduleManager({crewId,crewName}:{crewId:string;crewName:string}){
  const [month,setMonth]=useState(currentMonth());
  const [data,setData]=useState<Response|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [rangeForm,setRangeForm]=useState(emptyForm);
  const [calendarRefresh,setCalendarRefresh]=useState(0);

  const [editingSchedule,setEditingSchedule]=useState<EditScheduleTarget|null>(null);
  const [editForm,setEditForm]=useState({shiftNumber:1,startTime:'09:00',endTime:'18:00',lateToleranceMinutes:'0',overtimePreapproved:false});

  async function load(){
    setBusy(true);
    setError('');
    try{
      setData(await api.get<Response>(`/admin-store-schedules/crew/${crewId}?month=${month}`));
    }catch(e){
      setError(message(e));
    }finally{
      setBusy(false);
    }
  }

  useEffect(()=>{void load();},[crewId,month]);

  async function saveRange(e:FormEvent){
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try{
      const result=await submitScheduleRange(body=>api.post<RangeResult>('/admin-store-schedules/range',body),{crewId,...rangeForm,lateToleranceMinutes:Number(rangeForm.lateToleranceMinutes)},setNotice);
      setNotice(`${result.created} jadwal dibuat. ${result.skippedHoliday} tanggal libur, ${result.skippedExisting} jadwal lama, dan ${result.skippedEvent} benturan event dan ${result.skippedOverlap||0} shift bertumpuk dilewati. ${(result.warnings||[]).join(' ')}`);
      setRangeForm(emptyForm);
      await load();
      setCalendarRefresh(prev=>prev+1);
    }catch(e){
      setError(message(e));
    }finally{
      setBusy(false);
    }
  }

  function openEditFromTable(s:Schedule){
    setEditingSchedule({
      id:s.id,
      schedule_date:s.schedule_date,
      shift_number:s.shift_number||1,
      start_time:s.start_time,
      end_time:s.end_time,
      late_tolerance_minutes:s.late_tolerance_minutes||0,
      overtime_preapproved:!!s.overtime_preapproved
    });
    setEditForm({
      shiftNumber:s.shift_number||1,
      startTime:s.start_time.slice(0,5),
      endTime:s.end_time.slice(0,5),
      lateToleranceMinutes:String(s.late_tolerance_minutes||0),
      overtimePreapproved:!!s.overtime_preapproved
    });
  }

  function openEditFromCalendar(day:CalendarDay){
    const matched=data?.schedules.find(s=>s.schedule_date===day.date);
    setEditingSchedule({
      id:matched?.id||day.scheduleId||null,
      schedule_date:day.date,
      shift_number:day.shiftNumber||matched?.shift_number||1,
      start_time:day.startTime||matched?.start_time||'09:00',
      end_time:day.endTime||matched?.end_time||'18:00',
      late_tolerance_minutes:matched?.late_tolerance_minutes||0,
      overtime_preapproved:!!matched?.overtime_preapproved
    });
    setEditForm({
      shiftNumber:day.shiftNumber||matched?.shift_number||1,
      startTime:(day.startTime||matched?.start_time||'09:00').slice(0,5),
      endTime:(day.endTime||matched?.end_time||'18:00').slice(0,5),
      lateToleranceMinutes:String(matched?.late_tolerance_minutes||0),
      overtimePreapproved:!!matched?.overtime_preapproved
    });
  }

  async function saveSingleEdit(e:FormEvent){
    e.preventDefault();
    if(!editingSchedule)return;
    setBusy(true);
    setError('');
    setNotice('');
    try{
      await api.post('/admin-store-schedules',{
        crewId,
        scheduleDate:editingSchedule.schedule_date,
        scheduleId:editingSchedule.id||undefined,
        shiftNumber:editForm.shiftNumber,
        startTime:editForm.startTime,
        endTime:editForm.endTime,
        lateToleranceMinutes:Number(editForm.lateToleranceMinutes),
        overtimePreapproved:editForm.overtimePreapproved
      });
      setNotice(`Jadwal tanggal ${editingSchedule.schedule_date} berhasil diubah ke Shift ${editForm.shiftNumber} (${editForm.startTime}–${editForm.endTime} WIB).`);
      setEditingSchedule(null);
      await load();
      setCalendarRefresh(prev=>prev+1);
    }catch(e){
      setError(message(e));
    }finally{
      setBusy(false);
    }
  }

  function toggleDay(day:number){
    setRangeForm(previous=>({...previous,workDays:previous.workDays.includes(day)?previous.workDays.filter(value=>value!==day):[...previous.workDays,day].sort()}));
  }

  return <div className="space-y-5">
    <p className="text-sm text-slate-600">{translateUI("Buat jadwal") + " "}<strong>{crewName}</strong>{" " + translateUI("berdasarkan shift dan rentang tanggal. Ubah jadwal per tanggal untuk mengganti shift yang sudah ada.")}</p>
    {error&&<p role="alert" className="ui-error p-3 rounded-xl text-sm">{translateUI(error)}</p>}
    {notice&&<p role="status" className="ui-success p-3 rounded-xl text-sm">{translateUI(notice)}</p>}
    <label className="block text-xs text-slate-600">{translateUI("Bulan kalender")}<input aria-label={translateUI("Bulan jadwal Store")} type="month" className={control+' !w-auto'} value={month} onChange={e=>setMonth(e.target.value)}/></label>
    {data&&!data.assignment?<p className="bg-amber-50 text-amber-800 p-3 rounded-xl text-sm">{translateUI("Belum ada lokasi kerja aktif pada bulan ini.")}</p>:data?.assignment&&<p className="text-sm text-slate-700">{translateUI("Lokasi kerja:") + " "}<strong>{data.assignment.store.name}</strong> • {data.assignment.start_date}{data.assignment.end_date?` sampai ${data.assignment.end_date}`:''}</p>}

    <form onSubmit={saveRange} className="grid sm:grid-cols-2 gap-3 border border-slate-200 rounded-xl p-4">
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-900">{translateUI("Buat jadwal rentang")}</strong>
      </div>
      <label className="text-xs text-slate-600">{translateUI("Tanggal mulai")}<input required type="date" className={control} value={rangeForm.startDate} onChange={e=>setRangeForm({...rangeForm,startDate:e.target.value})}/></label>
      <label className="text-xs text-slate-600">{translateUI("Tanggal selesai")}<input required min={rangeForm.startDate} type="date" className={control} value={rangeForm.endDate} onChange={e=>setRangeForm({...rangeForm,endDate:e.target.value})}/></label>
      <fieldset className="sm:col-span-2">
        <legend className="text-xs text-slate-600 mb-2">{translateUI("Hari kerja")}</legend>
        <div className="flex flex-wrap gap-2">{DAY_OPTIONS.map(day=><label key={day.value} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${rangeForm.workDays.includes(day.value)?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-500'}`}><input type="checkbox" className="sr-only" checked={rangeForm.workDays.includes(day.value)} onChange={()=>toggleDay(day.value)}/>{day.label}</label>)}</div>
      </fieldset>
      <ShiftFields shiftNumber={rangeForm.shiftNumber} startTime={rangeForm.startTime} endTime={rangeForm.endTime} disabled={busy} onChange={patch=>setRangeForm({...rangeForm,...patch})}/>
      <label className="text-xs text-slate-600 sm:col-span-2">{translateUI("Toleransi telat (menit)")}<input required type="number" min="0" max="240" className={control} value={rangeForm.lateToleranceMinutes} onChange={e=>setRangeForm({...rangeForm,lateToleranceMinutes:e.target.value})}/></label>
      <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input aria-label={translateUI("Setujui lembur dari jadwal")} type="checkbox" className="mt-1" checked={rangeForm.overtimePreapproved} onChange={e=>setRangeForm({...rangeForm,overtimePreapproved:e.target.checked})}/><span><strong>{translateUI("Setujui lembur dari jadwal")}</strong><small className="block mt-1">{translateUI("Jam penuh setelah jam pulang langsung disetujui. Jika tidak dicentang, lembur menunggu admin.")}</small></span></label>
      <button disabled={busy||rangeForm.startTime===rangeForm.endTime||!data?.assignment||!rangeForm.workDays.length} className={primary+' sm:col-span-2'}>{busy?translateUI("Menyimpan..."):translateUI("Buat Jadwal Rentang")}</button>
    </form>

    <AttendanceCalendar
      crewId={crewId}
      month={month}
      onMonthChange={setMonth}
      refreshTrigger={calendarRefresh}
      onEditSchedule={openEditFromCalendar}
    />

    <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th className="p-3 text-left">{translateUI("Tanggal")}</th>
            <th className="p-3 text-left">Shift</th>
            <th className="p-3 text-left">{translateUI("Jam WIB")}</th>
            <th className="p-3 text-left">{translateUI("Toleransi")}</th>
            <th className="p-3 text-left">{translateUI("Lembur")}</th>
            <th className="p-3 text-left">{translateUI("Aksi")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data?.schedules.map(s=>(
            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
              <td className="p-3 font-medium">{s.schedule_date}</td>
              <td className="p-3 whitespace-nowrap"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Shift {s.shift_number||1}</span></td>
              <td className="p-3 font-mono">{s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}{s.end_time<s.start_time&&<small className="block text-blue-700 font-sans">Pulang besok</small>}</td>
              <td className="p-3">{s.late_tolerance_minutes||0}{" " + translateUI("menit")}</td>
              <td className="p-3">{s.overtime_preapproved?<span className="text-emerald-700 font-medium">{translateUI("Disetujui")}</span>:<span className="text-slate-500">{translateUI("Perlu tinjauan")}</span>}</td>
              <td className="p-3"><button className={button} type="button" onClick={()=>openEditFromTable(s)}>{translateUI("Ubah")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {data&&!data.schedules.length&&<p className="p-5 text-sm text-center text-slate-500">{translateUI("Belum ada jadwal pada bulan ini.")}</p>}
    </div>

    <div className="sm:hidden space-y-3">
      {data?.schedules.map(s=>(
        <article key={s.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
          <div className="flex justify-between gap-2">
            <strong className="text-sm">{s.schedule_date}</strong>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">Shift {s.shift_number||1}</span>
          </div>
          <p className="text-sm font-mono">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)} WIB{s.end_time<s.start_time?' · Pulang besok':''}</p>
          <p className="text-xs text-slate-500">Toleransi {s.late_tolerance_minutes||0} menit · Lembur {s.overtime_preapproved?'disetujui':'perlu tinjauan'}</p>
          <button className={button+' w-full min-h-11'} type="button" onClick={()=>openEditFromTable(s)}>Ubah jadwal</button>
        </article>
      ))}
      {data&&!data.schedules.length&&<p className="text-sm text-slate-500 text-center">Belum ada jadwal pada bulan ini.</p>}
    </div>

    <Modal
      open={!!editingSchedule}
      onClose={()=>{if(!busy)setEditingSchedule(null);}}
      title={`Ubah Shift • ${editingSchedule?.schedule_date || ''}`}
    >
      {editingSchedule&&(
        <form onSubmit={saveSingleEdit} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600">
            <p><strong>Crew:</strong> {crewName}</p>
            <p className="mt-1"><strong>Tanggal:</strong> {editingSchedule.schedule_date}</p>
            {data?.assignment&&<p className="mt-1"><strong>Lokasi:</strong> {data.assignment.store.name}</p>}
          </div>

          <ShiftFields
            shiftNumber={editForm.shiftNumber}
            startTime={editForm.startTime}
            endTime={editForm.endTime}
            disabled={busy}
            onChange={patch=>setEditForm(prev=>({...prev,...patch}))}
          />

          <label className="block text-xs text-slate-600">
            {translateUI("Toleransi telat (menit)")}
            <input
              required
              type="number"
              min="0"
              max="240"
              className={control}
              value={editForm.lateToleranceMinutes}
              onChange={e=>setEditForm(prev=>({...prev,lateToleranceMinutes:e.target.value}))}
            />
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              aria-label={translateUI("Setujui lembur dari jadwal")}
              type="checkbox"
              className="mt-1"
              checked={editForm.overtimePreapproved}
              onChange={e=>setEditForm(prev=>({...prev,overtimePreapproved:e.target.checked}))}
            />
            <span>
              <strong>{translateUI("Setujui lembur dari jadwal")}</strong>
              <small className="block mt-1">{translateUI("Jam penuh setelah jam pulang langsung disetujui.")}</small>
            </span>
          </label>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={()=>setEditingSchedule(null)}
            >
              {translateUI("Batal")}
            </button>
            <button
              disabled={busy||editForm.startTime===editForm.endTime}
              className={primary}
              type="submit"
            >
              {busy?translateUI("Menyimpan..."):translateUI("Simpan Perubahan")}
            </button>
          </div>
        </form>
      )}
    </Modal>
  </div>;
}
