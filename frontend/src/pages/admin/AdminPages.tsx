import {t as translateUI,getLocale} from '../../lib/i18n';
import { arrivalLabel, overtimeLabel } from '../../lib/attendanceLabels';
import ExportButtons from '../../components/ui/ExportButtons';
import { branchLabel } from '../../lib/locationLabel';
import { useEffect, useState, type ReactNode } from "react"
import { api } from "../../lib/apiClient"
import DirectoryManager from "./DirectoryManager"
import {
  type Crew,
  type Directory,
  money,
  panel,
  button,
  control,
  primary,
  message,
} from "./adminData"
interface Attendance {
  late_minutes?: number
  overtime_minutes?: number
  overtime_status?: string
  store_schedule?: {start_time:string;end_time:string;late_tolerance_minutes?:number}|null
  event_schedule?: {start_time:string;end_time:string}|null
  id: string
  attendance_date: string
  status: string
  check_in: string | null
  check_out: string | null
  crew: { company_name?: string; job_title?: string; employee_code: string; user: { full_name: string } } | null
}
interface Audit {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string
  actor_user_id: string
  actor_name?: string
  entity_name?: string
  actor?: { full_name?: string; email?: string }
}
interface Summary {
  totalCrew: number
  hadirHariIni: number
  telatHariIni: number
  eventOngoing: number
  date: string
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left p-4 whitespace-nowrap">
                {translateUI(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j} className="p-4 text-slate-700">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="text-center p-8 text-sm text-slate-500">{" " + translateUI("Belum ada data yang sesuai.") + " "}</p>
      )}
    </div>
  )
}
export default function AdminPages({
  page,
  onNavigate,
}: {
  page: string
  onNavigate: (page: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [directory, setDirectory] = useState<Directory>({
    branches: [],
    stores: [],
    events: [],
  })
  const [crew, setCrew] = useState<Crew[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  async function load() {
    setLoading(true)
    setError("")
    try {
      if (page === "admin-dashboard")
        setSummary(await api.get("/dashboard/admin"))
      if (page === "admin-event")
        setDirectory(await api.get("/admin-directory"))
      if (page === "admin-payroll") setCrew(await api.get("/crew"))
      if (page === "admin-laporan") {
        if (from && to && from > to)
          throw new Error("Tanggal awal tidak boleh setelah tanggal akhir.")
        setAttendance(
          await api.get(
            "/reports/attendance?" +
            new URLSearchParams({
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
            }),
          ),
        )
      }
      if (page === "admin-audit") setAudit(await api.get("/audit-logs"))
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [page])
  const time = (s: string | null) =>
    s
      ? new Date(s).toLocaleString(getLocale(), { timeZone: "Asia/Jakarta" })
      : "Belum ada"
  const reportHeaders = ['Tanggal','Crew','Perusahaan','Jabatan','Jadwal (WIB)','Toleransi (menit)','Check-in (WIB)','Check-out (WIB)','Status masuk','Telat (menit)','Status lembur'];
  const reportRows = attendance.map(a => {
    const schedule = a.store_schedule || a.event_schedule;
    return [a.attendance_date,a.crew?.user?.full_name || 'Crew',a.crew?.company_name || 'Belum diisi',a.crew?.job_title || 'Belum diisi',schedule ? `${schedule.start_time.slice(0,5)} - ${schedule.end_time.slice(0,5)}` : translateUI('Tanpa jadwal'),a.store_schedule?.late_tolerance_minutes || 0,time(a.check_in),time(a.check_out),arrivalLabel(a),a.late_minutes ?? 0,overtimeLabel(a)];
  });
  return (
    <div className="p-4 sm:p-6 space-y-5">
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-700 p-4 rounded-xl text-sm"
        >
          {translateUI(error)}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{" " + translateUI("Data dibaca dari server JAWARA.") + " "}</p>
        <button
          disabled={loading}
          className={button}
          onClick={() => void load()}
        >{" " + translateUI("Muat ulang") + " "}</button>
      </div>
      {page === "admin-laporan" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void load()
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm text-slate-700">{" " + translateUI("Dari") + " "}<input
              type="date"
              className={control}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">{" " + translateUI("Sampai") + " "}<input
              type="date"
              className={control}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button disabled={loading} className={primary}>{translateUI("Terapkan")}</button>
        </form>
      )}
      {loading ? (
        <p className="p-8 text-slate-500">{translateUI("Memuat data...")}</p>
      ) : error ? null : (
        <>
          {page === "admin-dashboard" && summary && (
            <>
              <p className="text-sm text-slate-600">{" " + translateUI("Ringkasan") + " "}{summary.date} (WIB)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Crew aktif", summary.totalCrew],
                  ["Catatan check-in hari ini", summary.hadirHariIni],
                  ["Catatan terlambat hari ini", summary.telatHariIni],
                  ["Event berlangsung", summary.eventOngoing],
                ].map(([label, n]) => (
                  <div key={label} className={panel}>
                    <p className="text-sm text-slate-600">{translateUI(label)}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-3">
                      {n}
                    </p>
                  </div>
                ))}
              </div>
              <div className={panel}>
                <h2 className="font-semibold text-slate-900">{translateUI("Akses cepat")}</h2>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    className={primary}
                    onClick={() => onNavigate("admin-crew")}
                  >{" " + translateUI("Kelola Crew") + " "}</button>
                  <button
                    className={button}
                    onClick={() => onNavigate("admin-event")}
                  >{" " + translateUI("Kelola Event") + " "}</button>
                  <button
                    className={button}
                    onClick={() => onNavigate("admin-absensi")}
                  >{" " + translateUI("Periksa Absensi") + " "}</button>
                </div>
              </div>
            </>
          )}
          {page === "admin-event" && (
            <div className={panel}>
              <h2 className="font-semibold text-slate-900 mb-3">{" " + translateUI("Kelola Event") + " "}</h2>
              <DirectoryManager
                eventsOnly
                data={directory}
                onSaved={async () =>
                  setDirectory(await api.get("/admin-directory"))
                }
              />
              <p className="mt-5 text-sm text-amber-700">{" " + translateUI("Pembuatan event belum otomatis membuat koordinat lokasi dan jadwal absensi. Keduanya tetap perlu dikonfigurasi sebelum crew dapat absen.") + " "}</p>
            </div>
          )}
          {page === "admin-payroll" && (
            <>
              <div className="bg-amber-50 text-amber-800 rounded-xl p-4 text-sm">{" " + translateUI("Halaman payroll kembali tersedia. Saat ini menampilkan referensi gaji pokok asli dari Kelola Crew, bukan gaji bersih atau bukti pembayaran. Perhitungan tunjangan, potongan, dan proses pembayaran belum diaktifkan.") + " "}</div>
              <Table
                headers={["Crew", "Email", "Cabang", "Status", "Gaji Pokok"]}
                rows={crew.map((c) => [
                  c.user.full_name,
                  c.user.email,
                  branchLabel(c.branch) || "Belum ditetapkan",
                  c.status === "ACTIVE" ? "Aktif" : "Non-Aktif",
                  money(c.base_salary),
                ])}
              />
            </>
          )}
          {page === "admin-laporan" && (
            <>
              <p className="text-xs text-slate-500">{" " + translateUI("Menampilkan") + " "}{attendance.length}{" " + translateUI("catatan. Maksimal 1.000 catatan terbaru per rentang; persempit tanggal bila mencapai batas.") + " "}</p>
              <p className="text-sm text-slate-600">{translateUI('Status masuk mengikuti jadwal dan toleransi. Telat dibulatkan ke atas. Lembur dihitung per jam penuh setelah jadwal selesai dan memerlukan persetujuan atau jadwal prapersetujuan.')}</p>
              <ExportButtons filename="Laporan_Absensi" title="Laporan Absensi" subtitle={`${from || 'Semua tanggal'} - ${to || 'Sekarang'}`} headers={reportHeaders} rows={reportRows}/>
              <Table headers={['Tanggal','Crew','Jadwal (WIB)','Check-in (WIB)','Check-out (WIB)','Status lembur']} rows={attendance.map(a => {
                const schedule = a.store_schedule || a.event_schedule;
                return [a.attendance_date,
                  <div><strong>{a.crew?.user?.full_name || 'Crew'}</strong><p className="text-xs text-slate-500 mt-1">{[a.crew?.company_name,a.crew?.job_title].filter(Boolean).join(' · ')}</p></div>,
                  <div>{schedule ? `${schedule.start_time.slice(0,5)} - ${schedule.end_time.slice(0,5)}` : translateUI('Tanpa jadwal')}<p className="text-xs text-slate-500 mt-1">{translateUI('Toleransi')}: {a.store_schedule?.late_tolerance_minutes || 0} {translateUI('menit')}</p></div>,
                  <div>{time(a.check_in)}<p className={`text-xs font-semibold mt-1 ${a.status === 'LATE' ? 'text-amber-700' : 'text-emerald-700'}`}>{arrivalLabel(a)}{a.late_minutes ? ` · ${a.late_minutes} ${translateUI('menit')}` : ''}</p></div>,
                  time(a.check_out),overtimeLabel(a)];
              })} />
            </>
          )}
          {page === "admin-audit" && (
            <>
              <p className="text-xs text-slate-500">{" " + translateUI("Maksimal 200 aktivitas terbaru. Password tidak dicatat dalam audit.") + " "}</p>
              <Table
                headers={[
                  "Waktu (WIB)",
                  "Tindakan",
                  "Entitas",
                  "Nama Data",
                  "Pelaku",
                ]}
                rows={audit.map((a) => [
                  time(a.created_at),
                  a.action,
                  a.entity_type,
                  a.entity_name || "Nama data tidak tersedia",
                  a.actor_name || a.actor?.full_name || "Pengguna tidak tersedia",
                ])}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
