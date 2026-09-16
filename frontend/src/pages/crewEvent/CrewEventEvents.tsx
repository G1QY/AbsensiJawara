import {t as translateUI} from '../../lib/i18n';
import { branchLabel } from '../../lib/locationLabel';
import EventResults from '../../components/events/EventResults';
import { useEffect, useState } from 'react';
import EventWorkflow from './EventWorkflow';
import { CrewEventAssignment, eventAddress, eventEffectiveStatus, eventIsFinished, eventSchedule, idClock, idDate, useCrewEventWorkspace } from './crewEventWorkspace';

export default function CrewEventEvents({ autoOpen = false, onCloseWorkflow }: { autoOpen?: boolean; onCloseWorkflow?: () => void }) {
  const { data, loading, error, reload } = useCrewEventWorkspace();
  const [detailId,setDetailId]=useState('');
  const [detailTab,setDetailTab]=useState<'Inventory'|'Operasional'>('Inventory');
  const [selected, setSelected] = useState<CrewEventAssignment | null>(null);
  useEffect(() => {
    if (autoOpen && data?.assignments.length && !selected) {
      setSelected(data.assignments.find(row => row.status === 'ACTIVE' && row.event.status === 'ONGOING' && !eventIsFinished(row)) || data.assignments.find(row => !eventIsFinished(row)) || data.assignments[0]);
    }
  }, [autoOpen, data, selected]);
  if (selected) return <EventWorkflow assignment={data?.assignments.find(row=>row.id===selected.id)||selected} initialStep={selected.workflow.current_step} onBack={() => { setSelected(null); reload(); onCloseWorkflow?.(); }} />;
  if (loading) return <State text="Memuat event Anda…" />;
  if (error) return <State text={error} error />;
  const rows = [...(data?.assignments || [])].sort((a, b) => b.event.event_date.localeCompare(a.event.event_date));
  return <div className="p-4 sm:p-6">
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100"><h1 className="font-semibold text-slate-900">{translateUI("Event Saya")}</h1><p className="text-xs text-slate-500 mt-1">{translateUI("Event muncul setelah admin menugaskan akun Anda melalui Kelola Event.")}</p></div>
      <div className="divide-y divide-slate-100">
        {rows.map(row => { const schedule = eventSchedule(row); const attendance = row.attendance[0]; const status = eventEffectiveStatus(row); const ended = eventIsFinished(row); return <article key={row.id} className="p-4 flex flex-wrap items-center gap-3 hover:bg-slate-50/60">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{row.event.event_name}</strong><span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{row.event.event_code}</span></div><p className="text-xs text-slate-500 mt-1">{idDate(row.event.event_date)} • {row.event.start_time&&row.event.end_time ? `${row.event.start_time.slice(0,5)}–${row.event.end_time.slice(0,5)} WIB` : schedule ? `${schedule.start_time.slice(0,5)}–${schedule.end_time.slice(0,5)} WIB` : translateUI("Jadwal belum diisi")} • {eventAddress(row)}</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">Step {row.workflow.current_step}/15</span>{attendance?.check_out ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{translateUI("Absensi selesai,") + " "}{idClock(attendance.check_out)}</span> : attendance?.check_in ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">Clock In {idClock(attendance.check_in)}</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-blue-700">{translateUI("Belum Clock In")}</span>}<span className={`text-xs px-2 py-1 rounded-full ${status === 'ONGOING' ? 'bg-amber-50 text-amber-700' : ended ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{status}</span><button onClick={()=>setDetailId(detailId===row.id?'':row.id)} className="px-3 py-2 rounded-xl border text-xs">{translateUI("Detail Event")}</button><button onClick={() => setSelected(row)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">{ended || row.status !== 'ACTIVE' ? translateUI("Tinjau Workflow") : row.workflow.max_reached > 1 ? translateUI("Lanjutkan Workflow") : translateUI("Mulai")}</button></div>
          {detailId===row.id&&<section className="w-full space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">{[['Klien',row.event.client_name||'Belum diisi'],['Cabang',branchLabel(row.event.branch)||'Belum diisi'],['PIC',row.event.pic?.user?.full_name||'Belum ditetapkan'],['Tugas Anda',row.position||'Belum diisi'],['Status Penugasan',row.status],['Crew Aktif',String(row.team.length)]].map(([k,v])=><div key={k} className="rounded-xl bg-white p-3"><dt className="text-slate-500">{translateUI(k)}</dt><dd>{v}</dd></div>)}</dl><section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-semibold text-sm">{translateUI("Anggota Event")}</h3><div className="grid sm:grid-cols-2 gap-3">{row.members?.map(member=><div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">{member.name.slice(0,1)}</span><div className="min-w-0"><strong className="block text-sm">{member.name}{member.crew_id===row.event.pic_crew_id?' · PIC':''}</strong><p className="text-xs text-slate-500">{member.position||'Tugas belum diisi'} · {member.status==='ACTIVE'?translateUI("Aktif"):translateUI("Selesai")}</p></div></div>)}</div></section><div className="flex gap-3">{(['Inventory','Operasional'] as const).map(tab=><button key={tab} onClick={()=>setDetailTab(tab)} className={`rounded-xl px-4 py-2 text-sm ${detailTab===tab?'bg-blue-600 text-white':'border'}`}>{translateUI(tab)}</button>)}</div><EventResults eventId={row.event.id} data={row.workflow.data} eventName={row.event.event_name} eventDate={row.event.event_date} tab={detailTab} context={{Perusahaan:row.event.company_name || '',Cabang:branchLabel(row.event.branch)}}/></section>}
        </article>; })}
        {!rows.length && <p className="p-10 text-center text-sm text-slate-500">{translateUI("Belum ada penugasan event.")}</p>}
      </div>
    </section>
  </div>;
}

function State({ text, error = false }: { text: string; error?: boolean }) { return <div className="p-6"><div className={`rounded-2xl border p-5 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`} role={error ? 'alert' : 'status'}>{text}</div></div>; }
