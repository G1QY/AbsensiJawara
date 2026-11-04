import {useState} from 'react';
import CameraCapture from './CameraCapture';
import {api} from '../../lib/apiClient';
import type {DevicePosition} from '../../lib/deviceLocation';

interface Props {attendanceId:string;start:string;end:string;startedAt?:string|null;endedAt?:string|null;opensAt?:string|null;locationName?:string|null;onSaved:()=>Promise<void>}
const clock=(value?:string|null)=>value?new Date(value).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}):'Belum tercatat';
export default function BreakAttendance({attendanceId,start,end,startedAt,endedAt,opensAt,locationName,onSaved}:Props) {
  const [camera,setCamera]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=!!startedAt&&!endedAt,finished=!!endedAt,early=!!opensAt&&Date.now()<Date.parse(opensAt);
  const action=active?'Selesai istirahat':'Mulai istirahat';
  async function submit(blob:Blob,_preview:string,position?:DevicePosition) {
    if(!position){setError('GPS saat foto belum tersedia. Ambil foto kembali.');return;}
    setBusy(true);setError('');
    try {
      const form=new FormData();form.append('photo',blob,active?'break-end.jpg':'break-start.jpg');
      form.append('latitude',String(position.latitude));form.append('longitude',String(position.longitude));
      await api.postForm(`/attendance/${attendanceId}/break/${active?'end':'start'}`,form);
      setCamera(false);await onSaved();
    }catch(e){setError(e instanceof Error?e.message:'Istirahat belum tersimpan. Coba lagi.');}finally{setBusy(false);}
  }
  return <section aria-label="Istirahat shift" className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Istirahat shift</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">{finished?'Sudah selesai':active?'Sedang istirahat':'Belum mulai'}</span></div>
    <p className="text-sm text-slate-600">Jadwal {start.slice(0,5)} – {end.slice(0,5)} WIB</p>
    <div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3">Mulai<p className="mt-1 font-semibold">{clock(startedAt)}</p></div><div className="rounded-xl bg-slate-50 p-3">Selesai<p className="mt-1 font-semibold">{clock(endedAt)}</p></div></div>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {camera&&!finished?<><h4 className="text-sm font-semibold">Foto untuk {action.toLowerCase()}</h4><CameraCapture captureLocation locationName={locationName} activityLabel={action} accentColor="emerald" onCapture={submit}/><button type="button" disabled={busy} className="w-full min-h-11 text-sm text-slate-600" onClick={()=>setCamera(false)}>Batal</button></>:!finished&&<button type="button" disabled={busy||(!active&&early)} onClick={()=>setCamera(true)} className="w-full min-h-12 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{action} · ambil foto</button>}
    <p className="text-xs leading-relaxed text-slate-600">{active?'Ambil foto selesai istirahat sebelum Clock Out.':early?`Tombol mulai tersedia pukul ${start.slice(0,5)} WIB.`:'Foto, GPS, dan waktu aktual disimpan sebagai bukti istirahat.'}</p>
  </section>;
}
