import {useAuth} from '../../lib/AuthContext'
import {accountRoles} from '../../lib/accountRoles'
import {useStoreWorkspace, wibDate, clock, dateLabel} from '../crewStore/crewStoreWorkspace'
import {reviewLabel} from '../admin/attendanceData'

export default function StaffWorkspace({onAttendance,onHistory}:{onAttendance:()=>void;onHistory:()=>void}) {
  const {auth}=useAuth()
  const {data,loading,error}=useStoreWorkspace()
  const today=wibDate(), month=today.slice(0,7)
  const role=accountRoles[auth?.role||''] || 'Staff'
  const division=data?.crew.division || auth?.user.division
  const rows=(data?.attendance||[]).filter(a=>a.attendance_date.startsWith(month))
  const present=new Set(rows.filter(a=>a.check_in&&['APPROVED','NOT_REQUIRED'].includes(a.review_status)&&['PRESENT','LATE'].includes(a.status)).map(a=>a.attendance_date)).size
  const open=data?.attendance.find(a=>a.check_in&&!a.check_out)
  const schedule=open?.store_schedule||data?.schedules.find(s=>s.schedule_date===today)
  const latest=open||rows.find(a=>a.attendance_date===today)
  const place=data?.assignment?.store
  const stats=[['Hari hadir disetujui',present],['Menunggu tinjauan',rows.filter(a=>a.review_status==='PENDING').length],['Jadwal bulan ini',data?.schedules.length||0]]
  return <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
    <section className="rounded-2xl bg-blue-700 p-5 sm:p-7 text-white">
      <p className="text-sm text-blue-100">{role}{division?` · ${division}`:''}</p>
      <h2 className="text-xl sm:text-2xl font-bold mt-2">Halo, {auth?.user.full_name}</h2>
      <p className="mt-2 text-sm text-blue-100">{dateLabel(today)}</p>
      <div className="flex flex-wrap gap-3 mt-5">
        <button className="rounded-xl bg-white px-5 py-2.5 font-semibold text-blue-700" onClick={onAttendance}>Absensi Saya</button>
        <button className="rounded-xl border border-blue-300 px-5 py-2.5 font-semibold" onClick={onHistory}>Riwayat Saya</button>
      </div>
    </section>
    {loading&&<p role="status">Memuat pekerjaan…</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {!loading&&!error&&data&&<>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{stats.map(([label,value])=><section className="rounded-xl border border-slate-200 bg-white p-5" key={label}><p className="text-sm text-slate-600">{label}</p><p className="text-3xl font-bold mt-2">{value}</p><p className="text-xs text-slate-500 mt-2">{month}</p></section>)}</div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="font-semibold">Pekerjaan Saya</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">{[['Role',role],['Divisi',division||'—'],['Perusahaan',data.crew.company_name||'—'],['Jabatan',data.crew.job_title||'—'],['Lokasi kerja',place?.name||'Belum ditetapkan'],['Cabang',[place?.branch?.city_name,place?.branch?.name].filter(Boolean).join(' / ')||'—']].map(([label,value])=><div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-medium mt-1 break-words">{value}</dd></div>)}</dl>
          {!place&&<p className="text-sm rounded-lg bg-amber-50 text-amber-800 p-3">Minta admin menetapkan lokasi kerja dan jadwal absensi.</p>}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h3 className="font-semibold">{open?"Shift Berjalan":"Jadwal Hari Ini"}</h3>
          <p className="text-2xl font-bold">{schedule?`Shift ${schedule.shift_number||1} · ${schedule.start_time.slice(0,5)} – ${schedule.end_time.slice(0,5)} WIB${schedule.end_time<schedule.start_time?' (+1 hari)':''}`:'Belum ada jadwal'}</p>
          <div className="grid grid-cols-2 gap-3 text-sm"><p className="rounded-lg bg-slate-50 p-3">Clock In<strong className="block mt-1">{clock(latest?.check_in||null)}</strong></p><p className="rounded-lg bg-slate-50 p-3">Clock Out<strong className="block mt-1">{clock(latest?.check_out||null)}</strong></p></div>
          {latest&&<p className="text-sm">Tinjauan admin: <strong>{reviewLabel(latest.review_status)}</strong></p>}
          {schedule&&<p className="text-xs text-slate-500">Toleransi terlambat: {schedule.late_tolerance_minutes} menit</p>}
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold">Jadwal Berikutnya</h3>
        <ul className="divide-y divide-slate-100 mt-3">{data.schedules.filter(s=>s.schedule_date>today).sort((a,b)=>a.schedule_date.localeCompare(b.schedule_date)).slice(0,5).map(s=><li key={s.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm"><span>{dateLabel(s.schedule_date)}</span><strong>Shift {s.shift_number||1} · {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)} WIB{s.end_time<s.start_time?" (+1 hari)":""}</strong></li>)}</ul>
        {!data.schedules.some(s=>s.schedule_date>today)&&<p className="text-sm text-slate-500 mt-3">Belum ada jadwal berikutnya bulan ini.</p>}
      </section>
    </>}
  </div>
}
