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
  id: string
  attendance_date: string
  status: string
  check_in: string | null
  check_out: string | null
  crew: { employee_code: string; user: { full_name: string } } | null
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
                {h}
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
        <p className="text-center p-8 text-sm text-slate-500">
          Belum ada data yang sesuai.
        </p>
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
      ? new Date(s).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum ada"
  return (
    <div className="p-4 sm:p-6 space-y-5">
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-700 p-4 rounded-xl text-sm"
        >
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Data dibaca dari server Jawara.
        </p>
        <button
          disabled={loading}
          className={button}
          onClick={() => void load()}
        >
          Muat ulang
        </button>
      </div>
      {page === "admin-laporan" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void load()
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <label className="text-sm text-slate-700">
                  Dari
                  <input
                    type="date"
                    className={control}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Sampai
                  <input
                    type="date"
                    className={control}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <button disabled={loading} className={primary}>Terapkan</button>
              </form>
      )}
      {loading ? (
        <p className="p-8 text-slate-500">Memuat data...</p>
      ) : error ? null : (
        <>
          {page === "admin-dashboard" && summary && (
            <>
              <p className="text-sm text-slate-600">
                Ringkasan {summary.date} (WIB)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Crew aktif", summary.totalCrew],
                  ["Catatan check-in hari ini", summary.hadirHariIni],
                  ["Catatan terlambat hari ini", summary.telatHariIni],
                  ["Event berlangsung", summary.eventOngoing],
                ].map(([label, n]) => (
                  <div key={label} className={panel}>
                    <p className="text-sm text-slate-600">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-3">
                      {n}
                    </p>
                  </div>
                ))}
              </div>
              <div className={panel}>
                <h2 className="font-semibold text-slate-900">Akses cepat</h2>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    className={primary}
                    onClick={() => onNavigate("admin-crew")}
                  >
                    Kelola Crew
                  </button>
                  <button
                    className={button}
                    onClick={() => onNavigate("admin-event")}
                  >
                    Kelola Event
                  </button>
                  <button
                    className={button}
                    onClick={() => onNavigate("admin-absensi")}
                  >
                    Periksa Absensi
                  </button>
                </div>
              </div>
            </>
          )}
          {page === "admin-event" && (
            <div className={panel}>
              <h2 className="font-semibold text-slate-900 mb-3">
                Kelola Event
              </h2>
              <DirectoryManager
                eventsOnly
                data={directory}
                onSaved={async () =>
                  setDirectory(await api.get("/admin-directory"))
                }
              />
              <p className="mt-5 text-sm text-amber-700">
                Pembuatan event belum otomatis membuat koordinat lokasi dan
                jadwal absensi. Keduanya tetap perlu dikonfigurasi sebelum crew
                dapat absen.
              </p>
            </div>
          )}
          {page === "admin-payroll" && (
            <>
              <div className="bg-amber-50 text-amber-800 rounded-xl p-4 text-sm">
                Halaman payroll kembali tersedia. Saat ini menampilkan referensi
                gaji pokok asli dari Kelola Crew, bukan gaji bersih atau bukti
                pembayaran. Perhitungan tunjangan, potongan, dan proses
                pembayaran belum diaktifkan.
              </div>
              <Table
                headers={["Crew", "Email", "Cabang", "Status", "Gaji Pokok"]}
                rows={crew.map((c) => [
                  c.user.full_name,
                  c.user.email,
                  c.branch?.name || "Belum ditetapkan",
                  c.status === "ACTIVE" ? "Aktif" : "Non-Aktif",
                  money(c.base_salary),
                ])}
              />
            </>
          )}
          {page === "admin-laporan" && (
            <>
              <p className="text-xs text-slate-500">
                Menampilkan {attendance.length} catatan. Maksimal 1.000 catatan
                terbaru per rentang; persempit tanggal bila mencapai batas.
              </p>
              <Table
                headers={[
                  "Tanggal",
                  "Crew",
                  "Kode",
                  "Check-in (WIB)",
                  "Check-out (WIB)",
                  "Status",
                ]}
                rows={attendance.map((a) => [
                  a.attendance_date,
                  a.crew?.user?.full_name || "Crew",
                  a.crew?.employee_code || "—",
                  time(a.check_in),
                  time(a.check_out),
                  a.status,
                ])}
              />
            </>
          )}
          {page === "admin-audit" && (
            <>
              <p className="text-xs text-slate-500">
                Maksimal 200 aktivitas terbaru. Password tidak dicatat dalam
                audit.
              </p>
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
