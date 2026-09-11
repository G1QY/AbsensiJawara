import { useState, useEffect } from 'react';
import { api, ApiError } from '../../lib/apiClient';

interface CalendarDay {
  holidayName?: string;
  holidayKind?: string;
  date: string;
  type: 'STORE' | 'EVENT' | 'HOLIDAY' | 'NONE';
  source: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  lateMinutes: number;
  overtimeMinutes: number;
  overtimeStatus: string;
}

const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  LATE: 'bg-red-100 text-red-700 ring-red-300',
  ABSENT: 'bg-slate-200 text-slate-600 ring-slate-300',
  PERMISSION: 'bg-blue-100 text-blue-700 ring-blue-300',
  SICK: 'bg-purple-100 text-purple-700 ring-purple-300',
  HOLIDAY: 'bg-amber-100 text-amber-700 ring-amber-300',
  PENDING: 'bg-white text-slate-700 ring-slate-200',
  NO_SCHEDULE: 'bg-white text-slate-500 ring-slate-200',
};

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Hadir', LATE: 'Telat', ABSENT: 'Absen', PERMISSION: 'Izin',
  SICK: 'Sakit', HOLIDAY: 'Libur', PENDING: 'Terjadwal', NO_SCHEDULE: 'Tanpa jadwal',
};

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/** Kalender kerja — dipakai di halaman Absensi Crew Store & Crew Event. */
export default function AttendanceCalendar({ crewId }: { crewId?: string }) {
  const todayWib = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const now = new Date(todayWib + 'T12:00:00');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning,setWarning]=useState('');
  const [holidays, setHolidays] = useState<{holiday_date:string;name:string;kind:string}[]>([]);
  const [holidayDataAvailable, setHolidayDataAvailable] = useState(false);
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');setWarning('');setDays([]);setSelected(null);setHolidays([]);setHolidayDataAvailable(false);
    const query = crewId ? `?month=${monthStr}&crewId=${crewId}` : `?month=${monthStr}`;
    api.get<{ days: CalendarDay[];warnings?:string[];holidays?:{holiday_date:string;name:string;kind:string}[];holidayDataAvailable?:boolean }>(`/attendance/calendar${query}`)
      .then(res => { if (!cancelled) { setDays(res.days);setHolidays(res.holidays || []);setHolidayDataAvailable(res.holidayDataAvailable === true);setWarning((res.warnings||[]).join(" ")); setSelected(res.days.find(day => day.date === todayWib) || null); } })
      .catch(err => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Gagal memuat kalender.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [monthStr, crewId]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m); setYear(y);
  };

  // Bangun grid 7-kolom (Minggu-Sabtu) untuk bulan ini
  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay(); // 0=Minggu
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = new Map(days.map(d => [d.date, d]));

  const cells: (CalendarDay | null | 'empty')[] = [
    ...Array(startOffset).fill('empty'),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      return dayMap.get(dateStr) ?? null;
    }),
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <button aria-label="Bulan sebelumnya" onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="font-semibold text-slate-900 text-sm">
          {firstOfMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </h3>
        <button aria-label="Bulan berikutnya" onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {warning && <p role="status" className="text-xs text-amber-700 mb-3">{warning}</p>}
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400">Memuat kalender...</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (cell === 'empty') return <div key={i} />;
            const dateNum = i - startOffset + 1;
            const date = `${monthStr}-${String(dateNum).padStart(2, '0')}`;
            const day: CalendarDay = cell || { date, type: 'NONE', source: null, startTime: null, endTime: null,
              status: 'NO_SCHEDULE', checkIn: null, checkOut: null, lateMinutes: 0, overtimeMinutes: 0, overtimeStatus: 'NONE' };
            const isToday = date === todayWib;
            const isSelected = selected?.date === date;
            const plain = day.status === 'PENDING' || day.status === 'NO_SCHEDULE';
            return (
              <button key={date} type="button" onClick={() => setSelected(day)}
                aria-label={`${dateNum}, ${STATUS_LABEL[day.status] || day.status}${day.holidayName ? ', ' + day.holidayName : ''}${isToday ? ', hari ini' : ''}`}
                aria-current={isToday ? 'date' : undefined} aria-pressed={isSelected}
                className={`relative h-11 sm:h-12 flex flex-col items-center justify-center rounded-lg text-sm font-semibold transition-colors
                  ${plain ? 'text-slate-700 hover:bg-slate-50' : (STATUS_STYLE[day.status] || STATUS_STYLE.PENDING) + ' ring-1'}
                  ${isSelected ? 'outline outline-2 outline-blue-600 outline-offset-1' : isToday ? 'outline outline-2 outline-blue-400' : ''}`}>
                {dateNum}
                {day.holidayName && day.type !== 'HOLIDAY' && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />}
                {day.status === 'PENDING' && <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && holidayDataAvailable && (
        <section className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <h4 className="font-semibold">Libur nasional &amp; cuti bersama</h4>
          {holidays.length ? <ul className="mt-2 space-y-2">{holidays.map(holiday => (
            <li key={holiday.holiday_date}>{Number(holiday.holiday_date.slice(8))} {firstOfMonth.toLocaleDateString('id-ID', { month:'long' })}: {holiday.name}</li>
          ))}</ul> : <p className="mt-1">Tidak ada libur nasional atau cuti bersama pada bulan ini.</p>}
          <p className="mt-2">Jadwal kerja tetap mengikuti penugasan admin.</p>
        </section>
      )}
      {/* Legenda */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <span key={key} className={`text-xs font-medium px-2 py-1 rounded-lg ring-1 ${STATUS_STYLE[key]}`}>{label}</span>
        ))}
      </div>

      {/* Detail tanggal terpilih */}
      {selected && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              {new Date(`${selected.date}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ring-1 ${STATUS_STYLE[selected.status]}`}>
              {STATUS_LABEL[selected.status] || selected.status}
            </span>
          </div>
          {selected.holidayName && selected.type !== 'HOLIDAY' && <p className="text-xs text-amber-700">{selected.holidayName}. Anda tetap memiliki jadwal kerja pada tanggal ini.</p>}
          <p className="text-xs text-slate-500">{selected.type === 'NONE' ? 'Keterangan' : selected.type === 'HOLIDAY' ? 'Keterangan' : selected.type === 'STORE' ? 'Toko' : 'Event'}: {selected.source || 'Tidak ada jadwal kerja pada tanggal ini.'}</p>
          {selected.type !== 'HOLIDAY' && selected.type !== 'NONE' ? <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-slate-400">Jadwal</p>
              <p className="font-mono font-semibold text-slate-700">{selected.startTime?.slice(0, 5)} - {selected.endTime?.slice(0, 5)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-slate-400">Clock In / Out</p>
              <p className="font-mono font-semibold text-slate-700">
                {selected.checkIn ? new Date(selected.checkIn).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) : '—'}
                {' / '}
                {selected.checkOut ? new Date(selected.checkOut).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            {selected.lateMinutes > 0 && (
              <div className="bg-red-50 rounded-lg p-2.5">
                <p className="text-red-500">Terlambat</p>
                <p className="font-semibold text-red-700">{selected.lateMinutes} menit</p>
              </div>
            )}
            {selected.overtimeMinutes > 0 && (
              <div className="bg-amber-50 rounded-lg p-2.5">
                <p className="text-amber-600">Lembur ({selected.overtimeStatus === 'PENDING' ? 'menunggu approval' : selected.overtimeStatus.toLowerCase()})</p>
                <p className="font-semibold text-amber-700">{Math.floor(selected.overtimeMinutes / 60)} jam</p>
              </div>
            )}
          </div> : null}
        </div>
      )}
    </div>
  );
}
