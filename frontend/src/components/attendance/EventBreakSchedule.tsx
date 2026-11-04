import {useState} from 'react';
import BreakFields from './BreakFields';
import {api} from '../../lib/apiClient';
import {primary,message} from '../../pages/admin/adminData';
export default function EventBreakSchedule({eventId,schedule,onSaved}:{eventId:string;schedule:{id:string;break_start_time?:string|null;break_end_time?:string|null};onSaved:()=>void}) {
  const [start,setStart]=useState(schedule.break_start_time?.slice(0,5)||''),[end,setEnd]=useState(schedule.break_end_time?.slice(0,5)||'');
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="min-w-56 space-y-2"><p className="text-xs text-slate-600">{schedule.break_start_time?`Istirahat ${schedule.break_start_time.slice(0,5)} – ${schedule.break_end_time?.slice(0,5)}`:'Tanpa jadwal istirahat'}</p><button type="button" className="min-h-11 text-xs text-blue-700 underline" onClick={()=>setOpen(v=>!v)}>{open?'Tutup':'Atur istirahat'}</button>{open&&<form className="space-y-2" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api.patch(`/admin-events/${eventId}/schedules/${schedule.id}/break`,{breakStartTime:start,breakEndTime:end});setOpen(false);onSaved();}catch(e){setError(message(e));}finally{setBusy(false);}}}><BreakFields start={start} end={end} disabled={busy} onChange={(a,b)=>{setStart(a);setEnd(b);}}/>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button className={primary+' min-h-11'} disabled={busy}>Simpan istirahat</button></form>}</div>;
}
