import { useState, useEffect, useCallback, useRef } from 'react';
import CameraCapture from '../../components/attendance/CameraCapture';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import { useGeolocation } from '../../hooks/useGeolocation';
import { api, ApiError } from '../../lib/apiClient';

type Step = 'loading' | 'no-schedule' | 'menu' | 'clockin-camera' | 'submitting-in' | 'clockin-result' | 'working' | 'clockout-camera' | 'submitting-out' | 'clockout-result' | 'completed';

interface TodayContext {
  type: 'STORE' | 'EVENT';
  storeAssignmentId: string | null;
  storeScheduleId: string | null;
  eventAssignmentId: string | null;
  eventScheduleId: string | null;
  eventId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  overtimePreapproved: boolean;
  locationName: string | null;
}

interface AttendanceState {
  id: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  review_status: string;
  late_minutes: number;
  overtime_minutes: number;
  overtime_status: string;
}

interface TodayResponse {
  crewId: string;
  hasSchedule: boolean;
  context: TodayContext | null;
  attendance: AttendanceState | null;
}

const jam = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : '—');
const approvalText = (value?:string) => ({PENDING:'Menunggu admin',APPROVED:'Disetujui',REJECTED:'Ditolak',NOT_REQUIRED:'Tidak perlu ditinjau',NONE:'Tidak ada'}[value||'']||value||'Belum tersedia');

export default function CrewStoreAbsensi({ showCalendar = true, onAttendanceChanged }: { showCalendar?: boolean; onAttendanceChanged?: () => void }) {
  const contextRevision=useRef('');
  const [step, setStep] = useState<Step>('loading');
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [inNote, setInNote] = useState('');
  const [outNote, setOutNote] = useState('');
  const [lastResult, setLastResult] = useState<AttendanceState & { durationMinutes?: number } | null>(null);
  const { getPosition } = useGeolocation();

  const loadToday = useCallback(async () => {
    setErrorMsg('');
    try {
      const data = await api.get<TodayResponse>('/attendance/today');
      const revision=JSON.stringify([data.context,data.attendance?.id,data.attendance?.check_in,data.attendance?.check_out]);
      const unchanged=revision===contextRevision.current;contextRevision.current=revision;
      setToday(data);
      const target:Step=!data.hasSchedule?'no-schedule':data.attendance?.check_out?'completed':data.attendance?.check_in?'working':'menu';
      setStep(previous=>unchanged&&['clockin-camera','clockout-camera','submitting-in','submitting-out','clockin-result','clockout-result'].includes(previous)?previous:target);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Gagal memuat jadwal hari ini.');
      setStep(previous=>previous==='loading'?'no-schedule':previous);
    }
  }, []);

  useEffect(() => {
    void loadToday();
    const timer = window.setInterval(() => void loadToday(), 15000);
    const refresh = () => void loadToday();
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loadToday]);

  const submitCheckIn = async (photoBlob: Blob) => {
    if (!today?.context) return;
    setStep('submitting-in');
    setErrorMsg('');
    try {
      const pos = await getPosition();
      const form = new FormData();
      form.append('photo', photoBlob, 'checkin.jpg');
      form.append('note', inNote);
      form.append('crewId', today.crewId);
      form.append('latitude', String(pos.latitude));
      form.append('longitude', String(pos.longitude));
      if (today.context.type === 'STORE') {
        form.append('storeAssignmentId', today.context.storeAssignmentId!);
        form.append('storeScheduleId', today.context.storeScheduleId!);
      } else {
        form.append('eventAssignmentId', today.context.eventAssignmentId!);
        form.append('eventScheduleId', today.context.eventScheduleId!);
      }

      const result = await api.postForm<AttendanceState>('/attendance/check-in', form);
      setLastResult(result);
      onAttendanceChanged?.();
      setStep('clockin-result');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal melakukan Clock In. Coba lagi.');
      setStep('clockin-camera');
    }
  };

  const submitCheckOut = async (photoBlob: Blob) => {
    if (!today?.attendance) return;
    setStep('submitting-out');
    setErrorMsg('');
    try {
      const pos = await getPosition();
      const form = new FormData();
      form.append('photo', photoBlob, 'checkout.jpg');
      form.append('note', outNote);
      form.append('latitude', String(pos.latitude));
      form.append('longitude', String(pos.longitude));

      const result = await api.postForm<AttendanceState & { durationMinutes: number }>(
        `/attendance/${today.attendance.id}/check-out`, form
      );
      setLastResult(result);
      onAttendanceChanged?.();
      setStep('clockout-result');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal melakukan Clock Out. Coba lagi.');
      setStep('clockout-camera');
    }
  };

  // ---------------------------------------------------------------------
  if (step === 'loading') {
    return <div className="p-6 flex items-center justify-center h-64 text-slate-400 text-sm">Memuat jadwal hari ini...</div>;
  }

  if (step === 'no-schedule') {
    return (
      <div className="p-6 space-y-5 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h3 className="font-semibold text-slate-900">Tidak Ada Jadwal Hari Ini</h3>
          <p className="text-sm text-slate-400 mt-1">{errorMsg || 'Kamu tidak memiliki jadwal kerja untuk hari ini.'}</p>
        </div>
        {showCalendar ? <AttendanceCalendar /> : null}
      </div>
    );
  }

  const ctx = today?.context;

  if (step === 'menu') {
    return (
      <div className="p-6 space-y-5 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900 text-sm mb-1">Jadwal Kerja Hari Ini</h3>
          <p className="text-xs text-slate-400 mb-4">{ctx?.locationName}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium">Jam Masuk</p>
              <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{ctx?.scheduledStart?.slice(0, 5)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-medium">Jam Pulang</p>
              <p className="text-2xl font-bold text-slate-900 font-mono mt-1">{ctx?.scheduledEnd?.slice(0, 5)}</p>
            </div>
          </div>
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>}

        <button
          onClick={() => setStep('clockin-camera')}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 flex items-center justify-center gap-3 shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Clock In Sekarang
        </button>

        <p className="text-center text-xs text-slate-400">Clock-in lebih awal pada tanggal jadwal diperbolehkan dan dihitung tepat waktu. Lokasi serta timestamp diambil dari GPS dan server.</p>

        {showCalendar ? <AttendanceCalendar /> : null}
      </div>
    );
  }

  if (step === 'clockin-camera') {
    return (
      <div className="p-6 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <h3 className="font-semibold text-slate-900">Ambil Foto untuk Clock In</h3>
          <p className="text-xs text-slate-400 mt-0.5">Pastikan wajah terlihat jelas</p>
        </div>
        {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>}
        <label className="block text-sm text-slate-700">Catatan Clock In<textarea maxLength={2000} value={inNote} onChange={e=>setInNote(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-white" placeholder="Catatan kehadiran (opsional)"/></label>
        <CameraCapture accentColor="emerald" locationName={ctx?.locationName} onCapture={(blob) => submitCheckIn(blob)} />
        <button onClick={() => setStep('menu')} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">Batal</button>
      </div>
    );
  }

  if (step === 'submitting-in' || step === 'submitting-out') {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-3">
        <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-500">Mengambil lokasi GPS & menyimpan ke server...</p>
      </div>
    );
  }

  if (step === 'clockin-result' && lastResult) {
    const isLate = lastResult.status === 'LATE';
    return (
      <div className="p-6 space-y-4 max-w-lg mx-auto animate-fade-in">
        <h3 className="font-semibold text-slate-900 text-center">Hasil Clock In</h3>

        <div className={`${isLate ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'} border rounded-2xl p-5 space-y-4`}>
          <div className={`flex items-center gap-2 ${isLate ? 'text-red-700' : 'text-emerald-700'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="font-bold">{isLate ? 'Terlambat Masuk!' : 'Tepat Waktu!'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Jadwal</p>
              <p className="text-xl font-bold text-slate-900 font-mono">{ctx?.scheduledStart?.slice(0, 5)}</p>
            </div>
            <div className={`${isLate ? 'bg-red-100' : 'bg-emerald-100'} rounded-xl p-3 text-center`}>
              <p className={`text-xs mb-1 ${isLate ? 'text-red-600' : 'text-emerald-600'}`}>Clock In</p>
              <p className={`text-xl font-bold font-mono ${isLate ? 'text-red-700' : 'text-emerald-700'}`}>{jam(lastResult.check_in)}</p>
            </div>
            {isLate && (
              <div className="col-span-2 bg-white rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">Terlambat</p>
                <p className="text-lg font-bold text-red-600">{lastResult.late_minutes} menit</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><strong>Persetujuan absensi:</strong> {approvalText(lastResult.review_status)}</div>
          <p className="text-xs text-slate-500 text-center">Waktu & lokasi tercatat otomatis dari server — tidak dapat diubah.</p>
        </div>

        <button onClick={() => loadToday()} className={`w-full py-3 rounded-xl text-white font-bold ${isLate ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
          Lanjut Bekerja →
        </button>
      </div>
    );
  }

  if (step === 'working') {
    return (
      <div className="p-6 space-y-5 max-w-lg mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="font-bold text-emerald-900 text-lg">Sudah Clock In!</h3>
          <div className="font-mono text-3xl font-bold text-emerald-800 mt-3">{jam(today?.attendance?.check_in ?? null)}</div>
          <p className="text-xs text-emerald-600 mt-1">Timestamp server</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Status</p>
            <p className="font-bold text-slate-900">{today?.attendance?.status === 'LATE' ? 'Telat' : 'Tepat Waktu'}</p>
            {(today?.attendance?.late_minutes ?? 0) > 0 && <span className="text-xs text-red-600">Telat {today?.attendance?.late_minutes} menit</span>}
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Jadwal Pulang</p>
            <p className="font-bold text-slate-900 font-mono">{ctx?.scheduledEnd?.slice(0, 5)}</p>
          </div>
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>}

        <button
          onClick={() => setStep('clockout-camera')}
          className="w-full py-4 rounded-2xl bg-amber-600 text-white font-bold text-lg hover:bg-amber-700 flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Clock Out Sekarang
        </button>
      </div>
    );
  }

  if (step === 'clockout-camera') {
    return (
      <div className="p-6 space-y-4 max-w-lg mx-auto">
        <div className="text-center">
          <h3 className="font-semibold text-slate-900">Ambil Foto untuk Clock Out</h3>
        </div>
        {errorMsg && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{errorMsg}</div>}
        <label className="block text-sm text-slate-700">Catatan Clock Out<textarea maxLength={2000} value={outNote} onChange={e=>setOutNote(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-white" placeholder="Catatan atau alasan lembur (opsional)"/></label>
        <CameraCapture accentColor="amber" locationName={ctx?.locationName} onCapture={(blob) => submitCheckOut(blob)} />
        <button onClick={() => setStep('working')} className="w-full text-center text-sm text-slate-400 hover:text-slate-600">Batal</button>
      </div>
    );
  }

  if (step === 'clockout-result' && lastResult) {
    const hasOvertime = lastResult.overtime_minutes > 0;
    const overtimeApproved = lastResult.overtime_status === 'APPROVED';
    return (
      <div className="p-6 space-y-4 max-w-lg mx-auto animate-fade-in">
        <h3 className="font-semibold text-slate-900 text-center">Hasil Clock Out</h3>
        <div className={`${hasOvertime ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-5 space-y-4`}>
          <div className={`flex items-center gap-2 ${hasOvertime ? 'text-amber-700' : 'text-slate-600'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="font-bold">{hasOvertime ? (overtimeApproved ? 'Lembur Disetujui' : 'Lembur Menunggu Persetujuan') : 'Clock Out Normal'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400">Jam Selesai Jadwal</p>
              <p className="text-xl font-bold text-slate-900 font-mono">{ctx?.scheduledEnd?.slice(0, 5)}</p>
            </div>
            <div className={`${hasOvertime ? 'bg-amber-100' : 'bg-slate-100'} rounded-xl p-3 text-center`}>
              <p className={`text-xs ${hasOvertime ? 'text-amber-600' : 'text-slate-500'}`}>Clock Out</p>
              <p className={`text-xl font-bold font-mono ${hasOvertime ? 'text-amber-700' : 'text-slate-700'}`}>{jam(lastResult.check_out)}</p>
            </div>
            {hasOvertime && (
              <div className="col-span-2 bg-white rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400">Estimasi Lembur (dibulatkan per jam penuh)</p>
                <p className="text-lg font-bold text-amber-600">{Math.floor(lastResult.overtime_minutes / 60)} jam</p>
                <p className="text-[11px] text-slate-500 mt-1">{overtimeApproved?`Bonus estimasi Rp${(Math.floor(lastResult.overtime_minutes/60)*10000).toLocaleString('id-ID')}`:'Belum menjadi bonus sampai disetujui admin'}</p>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => setStep('completed')} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">
          Selesai
        </button>
      </div>
    );
  }

  if (step === 'completed') {
    const att = today?.attendance;
    return (
      <div className="p-6 space-y-5 max-w-lg mx-auto">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg className="mx-auto h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-4 mb-1">Absensi Hari Ini Selesai</h3>
          <p className="text-slate-500 text-sm">Terima kasih atas kerja keras hari ini</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Clock In</p>
            <p className="font-bold text-sm text-slate-900 mt-0.5">{jam(att?.check_in ?? null)}</p>
            {(att?.late_minutes ?? 0) > 0 && <p className="text-xs text-red-500 mt-0.5">Telat {att?.late_minutes} menit • potongan estimasi Rp{(Math.ceil((att?.late_minutes??0)/60)*10000).toLocaleString('id-ID')}</p>}
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400">Clock Out</p>
            <p className="font-bold text-sm text-slate-900 mt-0.5">{jam(att?.check_out ?? null)}</p>
            {(att?.overtime_minutes ?? 0) > 0 && <p className="text-xs text-amber-600 mt-0.5">Lembur {Math.floor((att?.overtime_minutes ?? 0) / 60)} jam • {att?.overtime_status==='APPROVED'?`disetujui, bonus estimasi Rp${(Math.floor((att?.overtime_minutes??0)/60)*10000).toLocaleString('id-ID')}`:att?.overtime_status==='REJECTED'?'ditolak, tanpa bonus':'menunggu admin, belum menjadi bonus'}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs text-blue-600">Persetujuan Absensi</p><strong className="text-sm text-blue-900">{approvalText(att?.review_status)}</strong></div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-xs text-amber-600">Persetujuan Lembur</p><strong className="text-sm text-amber-900">{approvalText(att?.overtime_status)}</strong></div>
        </div>
        {showCalendar ? <AttendanceCalendar /> : null}
      </div>
    );
  }

  return null;
}
