import {t as translateUI} from '../../lib/i18n';
import { branchLabel } from '../../lib/locationLabel';
import { useState } from 'react';
import EventResults from '../../components/events/EventResults';
import { idDate, useCrewEventWorkspace } from './crewEventWorkspace';
export default function CeOperasional() {
 const { data, loading, error } = useCrewEventWorkspace();
 const [eventId,setEventId] = useState('');
 const rows = [...(data?.assignments || [])].sort((a,b)=>b.event.event_date.localeCompare(a.event.event_date));
 const row = rows.find(item=>item.event.id===eventId) || rows[0];
 if (loading || error || !row) return <div className="p-6" role={error ? 'alert' : 'status'}>{error || (loading ? translateUI("Memuat data event…") : translateUI("Belum ada event yang ditugaskan."))}</div>;
 return <div className="p-4 sm:p-6 space-y-4"><section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><div className="min-w-0 flex-1"><h1 className="font-semibold">{row.event.event_name}</h1><p className="mt-1 text-xs text-slate-500">{idDate(row.event.event_date)}</p></div>{rows.length>1 && <select aria-label={translateUI("Pilih event")} value={row.event.id} onChange={e=>setEventId(e.target.value)} className="max-w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{rows.map(item=><option key={item.event.id} value={item.event.id}>{item.event.event_name}</option>)}</select>}<span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{translateUI("Hanya lihat")}</span></section><EventResults eventId={row.event.id} eventName={row.event.event_name} eventDate={row.event.event_date} data={row.workflow.data} tab="Operasional" context={{Perusahaan:row.event.company_name||'',Cabang:branchLabel(row.event.branch)||'','Diekspor oleh':data?.crew.user?.full_name||'',Jabatan:data?.crew.job_title||''}} /></div>;
}
