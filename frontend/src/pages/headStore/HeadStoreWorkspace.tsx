import { useEffect, useState } from "react"
import { api } from "../../lib/apiClient"
import { t } from "../../lib/i18n"
import {
  arrivalLabel,
  overtimeLabel,
  attendanceStamp,
  type AttendanceStatusFields,
} from "../../lib/attendanceLabels"
import { button, control, primary, panel, message } from "../admin/adminData"
import ExportButtons from "../../components/ui/ExportButtons"
interface Branch {
  id: string
  name: string
}
interface Store {
  id: string
  name: string
  branch_id: string
  status: string
  location_kind: string
}
interface Crew {
  id: string
  branch_id: string
  full_name: string
  status: string
  company_name: string
  job_title: string
  stores: Store[]
}
interface Attendance extends AttendanceStatusFields {
  id: string
  attendance_date: string
  full_name: string
  store_name: string
  store_id: string
  branch_id: string
  start_time: string | null
  end_time: string | null
}
interface Workspace {
  city: string
  from: string
  to: string
  branches: Branch[]
  stores: Store[]
  crew: Crew[]
  attendance: Attendance[]
}
export default function HeadStoreWorkspace({ page }: { page: string }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date())
  const [data, setData] = useState<Workspace | null>(null),
    [from, setFrom] = useState(today),
    [to, setTo] = useState(today),
    [branch, setBranch] = useState(""),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true)
  async function load() {
    setLoading(true)
    setError("")
    setData(null)
    try {
      setData(await api.get("/head-store?" + new URLSearchParams({ from, to })))
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const matches = (id: string) => !branch || id === branch
  const crews = (data?.crew || []).filter(
    (c) =>
      matches(c.branch_id) &&
      [c.full_name, c.company_name, c.job_title]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const stores = (data?.stores || []).filter((s) => matches(s.branch_id))
  const attendance = (data?.attendance || []).filter(
    (a) =>
      matches(a.branch_id) &&
      [a.full_name, a.store_name]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const name = (id: string) =>
    data?.branches.find((b) => b.id === id)?.name || t("Belum ditetapkan")
  const isAttendance = page === "hs-attendance",
    isCrew = page === "hs-crew"
  const headers = isAttendance
    ? [
        "Tanggal",
        "Crew",
        "Cabang",
        "Store",
        "Jadwal (WIB)",
        "Check-in (WIB)",
        "Status masuk",
        "Telat (menit)",
        "Check-out (WIB)",
        "Status lembur",
      ]
    : ["Crew", "Perusahaan", "Jabatan", "Cabang", "Store aktif", "Status"]
  const rows = isAttendance
    ? attendance.map((a) => [
        a.attendance_date,
        a.full_name,
        name(a.branch_id),
        a.store_name,
        a.start_time
          ? `${a.start_time.slice(0, 5)} - ${a.end_time?.slice(0, 5)}`
          : t("Tanpa jadwal"),
        attendanceStamp(a.check_in),
        arrivalLabel(a),
        a.late_minutes ?? 0,
        attendanceStamp(a.check_out),
        overtimeLabel(a),
      ])
    : crews.map((c) => [
        c.full_name,
        c.company_name,
        c.job_title,
        name(c.branch_id),
        c.stores.map((s) => s.name).join(", ") || t("Belum ditugaskan"),
        t(c.status === "ACTIVE" ? "Aktif" : "Nonaktif"),
      ])
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="font-semibold text-xl">
            {t("Monitoring Kota")}
            {data ? ` · ${data.city}` : ""}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t("Cabang, store dan crew sesuai kota tanggung jawab Anda.")}
          </p>
        </div>
        <button
          className={button}
          onClick={() => void load()}
          disabled={loading}
        >
          {t("Muat ulang")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void load()
        }}
        className="flex flex-wrap gap-3 items-end"
      >
        <label className="text-sm">
          {t("Dari")}
          <input
            required
            type="date"
            className={control}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          {t("Sampai")}
          <input
            required
            type="date"
            className={control}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className={primary} disabled={loading}>
          {t("Terapkan")}
        </button>
      </form>
      {loading ? (
        <p>{t("Memuat data...")}</p>
      ) : (
        data && (
          <>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm flex-1 min-w-48">
                {t("Cabang")}
                <select
                  className={control}
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="">{t("Semua cabang")}</option>
                  {data.branches.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              {(isCrew || isAttendance) && (
                <label className="text-sm flex-1 min-w-48">
                  {t("Cari crew")}
                  <input
                    className={control}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
              )}
            </div>
            {!isCrew && !isAttendance ? (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    [
                      t("Cabang"),
                      data.branches.filter((b) => matches(b.id)).length,
                    ],
                    [t("Store & Kantor"), stores.length],
                    [
                      t("Crew aktif"),
                      crews.filter((c) => c.status === "ACTIVE").length,
                    ],
                    [t("Catatan absensi"), attendance.length],
                  ].map(([label, count]) => (
                    <div className={panel} key={label}>
                      <p className="text-sm text-slate-500">{label}</p>
                      <strong className="block text-3xl mt-2">{count}</strong>
                    </div>
                  ))}
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                  {data.branches
                    .filter((b) => matches(b.id))
                    .map((b) => (
                      <section className={panel} key={b.id}>
                        <h3 className="font-semibold">{b.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {
                            data.crew.filter(
                              (c) =>
                                c.branch_id === b.id && c.status === "ACTIVE",
                            ).length
                          }{" "}
                          {t("crew aktif")}
                        </p>
                        <ul className="mt-3 divide-y divide-slate-100">
                          {data.stores
                            .filter((s) => s.branch_id === b.id)
                            .map((s) => (
                              <li
                                className="py-3 flex justify-between gap-3"
                                key={s.id}
                              >
                                <span>
                                  {s.name}
                                  <small className="block text-slate-500">
                                    {t(
                                      s.location_kind === "OFFICE"
                                        ? "Kantor"
                                        : "Store",
                                    )}
                                  </small>
                                </span>
                                <span className="text-xs">
                                  {t(
                                    s.status === "ACTIVE"
                                      ? "Aktif"
                                      : "Nonaktif",
                                  )}
                                </span>
                              </li>
                            ))}
                        </ul>
                        {!data.stores.some((s) => s.branch_id === b.id) && (
                          <p className="text-sm mt-3">
                            {t("Belum ada store.")}
                          </p>
                        )}
                      </section>
                    ))}
                </div>
              </>
            ) : (
              <>
                <ExportButtons
                  filename="Monitoring_Head_Store"
                  title={isAttendance ? "Absensi Kota" : "Crew per Cabang"}
                  subtitle={`${data.city} · ${data.from} - ${data.to}`}
                  headers={headers}
                  rows={rows}
                />
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {headers.map((h) => (
                          <th
                            className="p-3 text-left whitespace-nowrap"
                            key={h}
                          >
                            {t(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="p-3">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rows.length && (
                    <p className="p-6">{t("Belum ada data yang sesuai.")}</p>
                  )}
                </div>
              </>
            )}
            <p className="text-xs text-slate-500">
              {t(
                "Absensi maksimal 1.000 catatan per rentang. Persempit tanggal bila mencapai batas.",
              )}
            </p>
          </>
        )
      )}
    </div>
  )
}
