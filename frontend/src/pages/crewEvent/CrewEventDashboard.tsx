import { eventAddress, eventIsFinished, eventSchedule, idClock, idDate, rupiah, useCrewEventWorkspace } from './crewEventWorkspace';

export default function CrewEventDashboard({ onStartWorkflow }: { onStartWorkflow: () => void }) {
  const { data, loading, error } = useCrewEventWorkspace();
  if (loading) return <div className="p-6" role="status">Memuat dashboard Crew Event…</div>;
  if (error) return <div className="p-6"><p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">{error}</p></div>;
  const rows = data?.assignments || [];
  const active = rows.find(row => row.status === 'ACTIVE' && row.event.status === 'ONGOING' && !eventIsFinished(row)) || rows.find(row => row.status === 'ACTIVE' && row.event.status === 'SCHEDULED' && !eventIsFinished(row));
  const next = rows.filter(row => row.status === 'ACTIVE' && row.event.event_date > (active?.event.event_date || new Date().toISOString().slice(0,10))).sort((a,b)=>a.event.event_date.localeCompare(b.event.event_date))[0];
  const schedule = active && eventSchedule(active);
  const attendance = active?.attendance.find(item => item.attendance_date === active.event.event_date) || active?.attendance[0];
  const base = Number(data?.crew.base_salary) || 0;
  return <div className="p-4 sm:p-6 space-y-4">
    <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white"><p className="text-xs text-blue-100">Selamat datang,</p><h1 className="text-xl font-bold mt-1">{data?.crew.user?.full_name || 'Crew Event'}</h1><p className="text-xs text-blue-100 mt-1">{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'})} • Crew Event</p></section>
    {active ? <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><h2 className="font-semibold text-sm text-slate-900">Event Hari Ini / Berikutnya</h2><span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700">{active.event.status}</span></div><div className="p-5"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><span className="font-mono text-xs text-blue-600">{active.event.event_code}</span><h3 className="font-bold text-lg text-slate-900 mt-1">{active.event.event_name}</h3><p className="text-sm text-slate-500 mt-1">{eventAddress(active)}</p></div><button onClick={onStartWorkflow} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold">Lanjutkan Workflow</button></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">{[
      ['Jadwal', schedule ? `${schedule.start_time.slice(0,5)}–${schedule.end_time.slice(0,5)}` : 'Belum diatur'],
      ['PIC', active.event.pic?.user?.full_name || 'Belum ditentukan'],
      ['Tim', `${active.team.length} Crew`],
      ['Step Saat Ini', `Step ${active.workflow.current_step}/15`],
    ].map(([label,value])=><div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="block text-sm text-slate-900 mt-1">{value}</strong></div>)}</div></div></section> : <section className="bg-white rounded-2xl border border-slate-200 p-8 text-center"><h2 className="font-semibold">Belum ada event aktif</h2><p className="text-sm text-slate-500 mt-1">Penugasan baru akan muncul setelah disimpan admin.</p></section>}
    <div className="grid md:grid-cols-3 gap-3"><Card label="Status Clock In" value={idClock(attendance?.check_in || null)} detail={attendance?.status || 'Belum Clock In'} tone="green"/><Card label="Clock Out" value={idClock(attendance?.check_out || null)} detail={attendance?.check_out ? 'Sudah tercatat' : 'Belum Clock Out'} tone="blue"/><Card label="Payroll" value="Dikelola finance" detail="Perhitungan manual oleh tim finance" tone="slate"/></div>
    {next && <section className="bg-white rounded-2xl border border-slate-200 p-4"><h2 className="font-semibold text-sm">Event Berikutnya</h2><div className="mt-3 rounded-xl bg-slate-50 p-4"><strong className="text-sm">{next.event.event_name}</strong><p className="text-xs text-slate-500 mt-1">{idDate(next.event.event_date)} • {eventAddress(next)}</p></div></section>}
    <section className="bg-white rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><h2 className="font-semibold text-sm">Informasi Payroll</h2><span className="text-xs text-slate-500">Dikelola finance</span></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3"><Mini label="Gaji Pokok" value={rupiah(base)}/></div></section>
  </div>;
}

function Card({label,value,detail,tone}:{label:string;value:string;detail:string;tone:string}) { const bg=tone==='green'?'bg-emerald-50':tone==='blue'?'bg-blue-50':'bg-white'; return <div className={`rounded-2xl border border-slate-200 p-4 ${bg}`}><p className="text-xs text-slate-500">{label}</p><strong className="block text-lg mt-2">{value}</strong><p className="text-xs text-slate-500 mt-1">{detail}</p></div>; }
function Mini({label,value,green,red,blue}:{label:string;value:string;green?:boolean;red?:boolean;blue?:boolean}) { return <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">{label}</p><strong className={`block text-sm mt-1 ${green?'text-emerald-700':red?'text-red-600':blue?'text-blue-700':''}`}>{value}</strong></div>; }
