import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/apiClient';
import { useGeolocation } from '../../hooks/useGeolocation';
import CameraCapture from './CameraCapture';

type Mode = 'IN' | 'OUT';

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
  context: {
    type: 'STORE' | 'EVENT';
    storeAssignmentId: string | null;
    storeScheduleId: string | null;
    eventAssignmentId: string | null;
    eventScheduleId: string | null;
    eventId: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    locationName: string | null;
  } | null;
  attendance: AttendanceState | null;
}

const clock = (value: string | null) => value
  ? new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  : 'Belum tercatat';

export default function AttendanceAction({ mode, eventId, onContinue, onRecorded }: {
  mode: Mode;
  eventId: string;
  onContinue: () => void | Promise<void>;
  onRecorded?: () => void;
}) {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const { getPosition } = useGeolocation();

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const result = await api.get<TodayResponse>('/attendance/today');
      setToday(result);
      setError('');
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Status absensi tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(), 15000);
    const refresh = () => void load();
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  const submit = useCallback(async (photo: Blob) => {
    const context = today?.context;
    if (!today || !context) return;
    setSubmitting(true);
    setError('');
    try {
      const position = await getPosition();
      const form = new FormData();
      form.append('photo', photo, mode === 'IN' ? 'checkin.jpg' : 'checkout.jpg');
      form.append('note', note);
      form.append('latitude', String(position.latitude));
      form.append('longitude', String(position.longitude));

      let result: AttendanceState;
      if (mode === 'IN') {
        form.append('crewId', today.crewId);
        form.append('eventAssignmentId', context.eventAssignmentId || '');
        form.append('eventScheduleId', context.eventScheduleId || '');
        result = await api.postForm<AttendanceState>('/attendance/check-in', form);
      } else {
        if (!today.attendance?.id) throw new Error('Clock In belum tercatat.');
        result = await api.postForm<AttendanceState>(`/attendance/${today.attendance.id}/check-out`, form);
      }

      setToday(current => current ? { ...current, attendance: result } : current);
      setCamera(false);
      onRecorded?.();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        await load();
      } else {
        setError(reason instanceof Error ? reason.message : 'Absensi gagal disimpan.');
      }
      setCamera(false);
    } finally {
      setSubmitting(false);
    }
  }, [getPosition, load, mode, note, onRecorded, today]);

  if (loading) return <State text="Memuat status absensi..." />;

  const context = today?.context;
  if (!today?.hasSchedule || !context || context.type !== 'EVENT' || context.eventId !== eventId) {
    return <State text={error || 'Tidak ada jadwal aktif untuk event ini pada hari ini.'} error={!!error} />;
  }

  const recorded = mode === 'IN' ? today.attendance?.check_in : today.attendance?.check_out;
  if (recorded) {
    return <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-900">{mode === 'IN' ? 'Clock In sudah tercatat' : 'Clock Out sudah tercatat'}</p>
        <p className="mt-2 font-mono text-2xl font-bold text-emerald-800">{clock(recorded)}</p>
        <p className="mt-1 text-xs text-emerald-700">Data ini sama dengan data pada menu Absensi.</p>
      </div>
      <button type="button" onClick={() => void onContinue()} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Lanjutkan</button>
    </div>;
  }

  if (mode === 'OUT' && !today.attendance?.check_in) {
    return <State text="Clock In belum tercatat. Lakukan Clock In melalui menu Absensi atau langkah Clock In pada Event Saya." error />;
  }

  if (submitting) return <State text="Mengambil lokasi dan menyimpan absensi..." />;

  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{context.locationName}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Jam masuk</span><strong className="font-mono">{context.scheduledStart.slice(0, 5)} WIB</strong></div>
        <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Jam pulang</span><strong className="font-mono">{context.scheduledEnd.slice(0, 5)} WIB</strong></div>
      </div>
    </div>

    {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}

    {camera ? <>
      <label className="block text-sm text-slate-700">Catatan {mode === 'IN' ? 'Clock In' : 'Clock Out'}
        <textarea maxLength={2000} value={note} onChange={event => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3" placeholder="Catatan kehadiran, opsional" />
      </label>
      <CameraCapture accentColor={mode === 'IN' ? 'emerald' : 'amber'} locationName={context.locationName} onCapture={photo => void submit(photo)} />
      <button type="button" onClick={() => setCamera(false)} className="w-full text-sm text-slate-500">Batal</button>
    </> : <button type="button" onClick={() => setCamera(true)} className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white ${mode === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
      {mode === 'IN' ? 'Clock In Sekarang' : 'Clock Out Sekarang'}
    </button>}
  </div>;
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`rounded-2xl border p-5 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`} role={error ? 'alert' : 'status'}>{text}</div>;
}
