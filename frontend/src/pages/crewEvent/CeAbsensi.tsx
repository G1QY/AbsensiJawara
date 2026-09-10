import { useCallback, useEffect, useState } from 'react';
import ExportButtons from '../../components/ui/ExportButtons';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import { api, ApiError } from '../../lib/apiClient';
import { useAuth } from '../../lib/AuthContext';
import CrewAttendance from '../crewStore/CrewStoreAbsensi';

const LATE_RATE = 10000;
const OVERTIME_RATE = 10000;
const money = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
const clock = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—';
const approval: Record<string, string> = { NONE: 'Tidak ada', PENDING: 'Menunggu admin', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };

interface AttendanceApiRow {
  id: string; attendance_date: string; check_in: string | null; check_out: string | null;
  status: string; review_status: string; late_minutes: number; overtime_minutes: number; overtime_status: string;
  store_schedule?: { start_time: string; end_time: string; overtime_preapproved: boolean } | null;
  event_schedule?: { start_time: string; end_time: string; overtime_preapproved: boolean } | null;
  store_assignment?: { store: { name: string } | null } | null;
  event_assignment?: { event: { event_name: string } | null } | null;
}

interface HistoryRow {
  id: string; source: string; date: string; schedule: string; checkIn: string; checkOut: string;
  attendanceStatus: string; attendanceApproval:string; lateHours: number; overtimeHours: number; overtimeStatus: string;
  preapproved: boolean; deduction: number; bonus: number;
}

function mapRow(a: AttendanceApiRow): HistoryRow {
  const schedule = a.store_schedule || a.event_schedule;
  const lateHours = Math.ceil(Math.max(0, Number(a.late_minutes) || 0) / 60);
  const overtimeHours = Math.floor(Math.max(0, Number(a.overtime_minutes) || 0) / 60);
  const acceptedAttendance = a.review_status !== 'REJECTED' && ['PRESENT', 'LATE'].includes(a.status);
  return {
    id: a.id,
    source: a.store_assignment?.store?.name || a.event_assignment?.event?.event_name || 'Lokasi kerja',
    date: new Date(`${a.attendance_date}T00:00:00+07:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }),
    schedule: schedule ? `${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}` : 'Belum ada jadwal',
    checkIn: clock(a.check_in), checkOut: clock(a.check_out),
    attendanceStatus: a.review_status === 'REJECTED' ? 'Ditolak' : a.status === 'LATE' ? 'Telat' : a.status === 'PRESENT' ? 'Tepat waktu' : 'Perlu tinjau',
    attendanceApproval: approval[a.review_status] || (a.review_status==='NOT_REQUIRED'?'Tidak perlu ditinjau':a.review_status),
    lateHours, overtimeHours, overtimeStatus: approval[a.overtime_status] || a.overtime_status,
    preapproved: !!schedule?.overtime_preapproved,
    deduction: acceptedAttendance ? lateHours * LATE_RATE : 0,
    bonus: acceptedAttendance && a.overtime_status === 'APPROVED' ? overtimeHours * OVERTIME_RATE : 0,
  };
}

export default function CrewAttendanceHistory({ showAttendance = true }: { showAttendance?: boolean }) {
  const { auth } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { const data = await api.get<AttendanceApiRow[]>('/attendance'); setRows(data.map(mapRow)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Riwayat absensi tidak dapat dimuat.'); }
    finally { setLoading(false); }
  }, [auth?.user.id]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);

  const totalLate = rows.reduce((n, r) => n + r.lateHours, 0);
  const totalOvertime = rows.filter(r => r.overtimeStatus === 'Disetujui').reduce((n, r) => n + r.overtimeHours, 0);
  const deduction = rows.reduce((n, r) => n + r.deduction, 0);
  const bonus = rows.reduce((n, r) => n + r.bonus, 0);
  const pending = rows.filter(r => r.overtimeStatus === 'Menunggu admin'||r.attendanceApproval === 'Menunggu admin').length;
  return <div className="p-4 sm:p-6 space-y-5">
    {showAttendance && <CrewAttendance showCalendar={false} onAttendanceChanged={() => void load()} />}
    {loading ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500" role="status">Memuat riwayat absensi...</p> : null}
    {error ? <p className="ui-error rounded-xl p-4" role="alert">{error}</p> : null}
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
      <strong>Potongan dan bonus milik Anda</strong>
      <p className="mt-1 text-xs leading-5">Telat dibulatkan ke atas per jam. Lembur memakai jam penuh dan bonus hanya masuk setelah disetujui admin atau sudah disetujui di jadwal. Kelebihan waktu clock-out tidak otomatis menjadi bonus.</p>
    </section>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <Summary label="Jam telat" value={`${totalLate} jam`} detail={`Potongan ${money(deduction)}`} tone="red" />
      <Summary label="Lembur disetujui" value={`${totalOvertime} jam`} detail={`Bonus ${money(bonus)}`} tone="green" />
      <Summary label="Menunggu persetujuan" value={pending} detail="Cek notifikasi untuk keputusan admin" tone="amber" />
      <Summary label="Bonus − potongan" value={money(bonus - deduction)} detail="Estimasi dari riwayat absensi" tone="blue" />
    </div>
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Riwayat Absensi — {auth?.user.full_name}</h2><p className="text-xs text-slate-500 mt-1">Tarif saat ini: potongan {money(LATE_RATE)}/jam, bonus {money(OVERTIME_RATE)}/jam.</p></div><ExportButtons filename="Riwayat-Potongan-Lembur" title="Riwayat Potongan dan Lembur" subtitle={auth?.user.full_name || 'Crew'} headers={['Lokasi/Event','Tanggal','Jadwal','Clock In','Status','Persetujuan Absensi','Clock Out','Jam Telat','Potongan','Jam Lembur','Persetujuan Lembur','Bonus']} rows={rows.map(r=>[r.source,r.date,r.schedule,r.checkIn,r.attendanceStatus,r.attendanceApproval,r.checkOut,r.lateHours,r.deduction,r.overtimeHours,r.overtimeStatus,r.bonus])}/></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Lokasi / Event','Tanggal & Jadwal','Clock In','Status','Persetujuan Absensi','Clock Out','Potongan Telat','Lembur','Persetujuan Lembur','Bonus'].map(h=><th key={h} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(r=><tr key={r.id}><td className="p-3 font-medium text-slate-900">{r.source}</td><td className="p-3 whitespace-nowrap">{r.date}<small className="block text-slate-500">{r.schedule} WIB</small></td><td className="p-3 font-mono">{r.checkIn}</td><td className="p-3"><Badge value={r.attendanceStatus}/></td><td className="p-3"><Badge value={r.attendanceApproval}/></td><td className="p-3 font-mono">{r.checkOut}</td><td className="p-3 text-red-700"><strong>{r.deduction?`-${money(r.deduction)}`:'—'}</strong>{r.lateHours>0&&<small className="block">{r.lateHours} jam</small>}</td><td className="p-3">{r.overtimeHours ? `${r.overtimeHours} jam` : '—'}{r.preapproved&&<small className="block text-emerald-700">Dari jadwal</small>}</td><td className="p-3"><Badge value={r.overtimeStatus}/></td><td className="p-3 text-emerald-700 font-semibold">{r.bonus?`+${money(r.bonus)}`:'—'}</td></tr>)}</tbody></table></div>
      {!rows.length && <p className="p-8 text-center text-sm text-slate-500">Belum ada riwayat absensi.</p>}
    </section>
    <AttendanceCalendar />
  </div>;
}

function Summary({label,value,detail,tone}:{label:string;value:string|number;detail:string;tone:'red'|'green'|'amber'|'blue'}) {
  const color={red:'bg-red-50 text-red-800',green:'bg-emerald-50 text-emerald-800',amber:'bg-amber-50 text-amber-800',blue:'bg-blue-50 text-blue-800'}[tone];
  return <div className={`rounded-2xl p-4 ${color}`}><p className="text-xs opacity-75">{label}</p><strong className="block text-xl mt-1">{value}</strong><small>{detail}</small></div>;
}
function Badge({value}:{value:string}) {
  const color=value==='Disetujui'||value==='Tepat waktu'?'bg-emerald-50 text-emerald-700':value==='Menunggu admin'||value==='Perlu tinjau'?'bg-amber-50 text-amber-700':value==='Ditolak'||value==='Telat'?'bg-red-50 text-red-700':'bg-slate-100 text-slate-600';
  return <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${color}`}>{value}</span>;
}
