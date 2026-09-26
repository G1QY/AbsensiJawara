import { useAuth } from "../../lib/AuthContext"
import { accountRoles } from "../../lib/accountRoles"
import {
  useStoreWorkspace,
  wibDate,
  clock,
  dateLabel,
  type StoreWorkSchedule,
} from "../crewStore/crewStoreWorkspace"
import { reviewLabel } from "../admin/attendanceData"
import { MiniChart } from "../admin/adminWidgets"
import { panel, button } from "../admin/adminData"

export default function StaffWorkspace({
  onAttendance,
  onHistory,
}: {
  onAttendance: () => void
  onHistory: () => void
}) {
  const { auth } = useAuth()
  const { data, loading, error } = useStoreWorkspace()
  const today = wibDate(),
    month = today.slice(0, 7),
    code = auth?.role || ""
  const role = accountRoles[code] || "Staff",
    production = code === "PRODUCTION_STAFF",
    head = code === "HEAD_OFFICE"
  const division = data?.crew.division || auth?.user.division
  const title = production
    ? "Shift Produksi"
    : head
      ? "Ringkasan Head Office"
      : "Agenda Kantor"
  const tone = production
    ? "bg-orange-700"
    : head
      ? "bg-indigo-700"
      : "bg-cyan-800"
  const rows = (data?.attendance || []).filter((a) =>
    a.attendance_date.startsWith(month),
  )
  const accepted = rows.filter(
    (a) =>
      a.check_in &&
      ["APPROVED", "NOT_REQUIRED"].includes(a.review_status) &&
      ["PRESENT", "LATE"].includes(a.status),
  )
  const present = new Set(accepted.map((a) => a.attendance_date)).size
  const schedules = (data?.schedules || []).filter((s) =>
    s.schedule_date.startsWith(month),
  )
  const upcoming = schedules
    .filter((s) => s.schedule_date > today)
    .sort((a, b) => a.schedule_date.localeCompare(b.schedule_date))
  const open = data?.attendance.find((a) => a.check_in && !a.check_out)
  const schedule =
    open?.store_schedule || schedules.find((s) => s.schedule_date === today)
  const latest = open || rows.find((a) => a.attendance_date === today)
  const place = data?.assignment?.store
  const hours = (s: StoreWorkSchedule) =>
    `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)} WIB${
      s.end_time <= s.start_time ? " (+1 hari)" : ""
    }`
  const stats = [
    ["Hari hadir disetujui", present],
    [
      "Menunggu tinjauan",
      rows.filter((a) => a.review_status === "PENDING").length,
    ],
    [production ? "Shift bulan ini" : "Hari terjadwal", schedules.length],
  ]
  const shift = (
    <section className={panel + " space-y-4"}>
      <div className="flex flex-wrap justify-between gap-2">
        <h2 className="font-semibold">
          {open
            ? "Shift Berjalan"
            : production
              ? "Shift Hari Ini"
              : "Jadwal Hari Ini"}
        </h2>
        {schedule && (
          <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-3 py-1">
            Shift {schedule.shift_number || 1}
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold">
        {schedule ? hours(schedule) : "Belum ada jadwal"}
      </p>
      <p className="text-sm text-slate-500">
        {place?.name || "Lokasi belum ditetapkan"}
        {open ? " · " + dateLabel(open.attendance_date) : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-4">
          <p>Clock In</p>
          <strong className="block mt-2 text-lg">
            {clock(latest?.check_in || null)}
          </strong>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p>Clock Out</p>
          <strong className="block mt-2 text-lg">
            {clock(latest?.check_out || null)}
          </strong>
        </div>
      </div>
      {latest && (
        <p className="text-sm">
          Tinjauan admin: <strong>{reviewLabel(latest.review_status)}</strong>
        </p>
      )}
      <button className={button} onClick={onAttendance}>
        {open ? "Lanjut Clock Out" : "Buka Absensi Saya"}
      </button>
    </section>
  )
  const agenda = (
    <section className={panel}>
      <h2 className="font-semibold">
        {production
          ? "Urutan Shift Berikutnya"
          : head
            ? "Agenda Kerja Berikutnya"
            : `Jadwal ${division || "Kantor"}`}
      </h2>
      <ul className="divide-y divide-slate-100 mt-3">
        {upcoming.slice(0, 5).map((s) => (
          <li
            key={s.id}
            className="py-3 flex flex-wrap justify-between gap-2 text-sm"
          >
            <div>
              <span>{dateLabel(s.schedule_date)}</span>
              <p className="text-xs text-slate-500 mt-1">
                {place?.name || "Lokasi kerja"}
              </p>
            </div>
            <div className="text-right">
              <strong>{hours(s)}</strong>
              <p className="text-xs text-slate-500 mt-1">
                Shift {s.shift_number || 1}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {!upcoming.length && (
        <p className="text-sm text-slate-500 mt-3">
          Belum ada jadwal berikutnya bulan ini.
        </p>
      )}
    </section>
  )
  const profile = (
    <section className={panel + " space-y-4"}>
      <h2 className="font-semibold">Pekerjaan Saya</h2>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        {[
          ["Role", role],
          ["Divisi", division || "Belum diisi"],
          ["Perusahaan", data?.crew.company_name || "Belum diisi"],
          ["Jabatan", data?.crew.job_title || "Belum diisi"],
          ["Lokasi kerja", place?.name || "Belum ditetapkan"],
          [
            "Cabang",
            [place?.branch?.city_name, place?.branch?.name]
              .filter(Boolean)
              .join(" / ") || "Belum ditetapkan",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {!place && (
        <p className="text-sm rounded-xl bg-amber-50 text-amber-800 p-3">
          Minta admin menetapkan lokasi kerja dan jadwal absensi.
        </p>
      )}
    </section>
  )
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <header className={`rounded-2xl ${tone} p-5 sm:p-7 text-white`}>
        <p className="text-sm opacity-90">
          {role}
          {division ? ` · ${division}` : ""}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">{title}</h1>
        <p className="mt-2 text-sm opacity-90">
          {auth?.user.full_name} · {dateLabel(today)}
        </p>
        <p className="text-sm mt-4 opacity-90">
          {production
            ? `Pantau shift dan kehadiran kamu${
                division ? " di bagian " + division : ""
              }.`
            : head
              ? "Ringkasan kehadiran dan agenda kerja pribadi."
              : `Jadwal kerja dan status absensi kamu${
                  division ? " di divisi " + division : ""
                }.`}
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <button
            className="rounded-xl bg-white px-5 py-2.5 font-semibold text-slate-900"
            onClick={onAttendance}
          >
            Absensi Saya
          </button>
          <button
            className="rounded-xl border border-white/50 px-5 py-2.5 font-semibold"
            onClick={onHistory}
          >
            Riwayat Saya
          </button>
        </div>
      </header>
      {loading && <p role="status">Memuat pekerjaan...</p>}
      {error && (
        <p role="alert" className="ui-error rounded-xl p-4">
          {error}
        </p>
      )}
      {!loading && !error && data && (
        <>
          {production && shift}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.map(([label, value]) => (
              <section className={panel} key={label}>
                <p className="text-sm text-slate-600">{label}</p>
                <p className="text-3xl font-bold mt-2">{value}</p>
                <p className="text-xs text-slate-500 mt-2">{month}</p>
              </section>
            ))}
          </div>
          {head ? (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                <MiniChart
                  title="Kehadiran Saya Bulan Ini"
                  subtitle={`${month} · catatan pribadi`}
                  color="#4f46e5"
                  points={[
                    {
                      label: "Tepat waktu",
                      value: accepted.filter((a) => a.status === "PRESENT")
                        .length,
                      details: accepted
                        .filter((a) => a.status === "PRESENT")
                        .map(
                          (a) => `${a.attendance_date} · ${clock(a.check_in)}`,
                        ),
                    },
                    {
                      label: "Terlambat",
                      value: accepted.filter((a) => a.status === "LATE").length,
                      details: accepted
                        .filter((a) => a.status === "LATE")
                        .map(
                          (a) =>
                            `${a.attendance_date} · ${a.late_minutes} menit`,
                        ),
                    },
                    {
                      label: "Menunggu",
                      value: rows.filter((a) => a.review_status === "PENDING")
                        .length,
                      details: rows
                        .filter((a) => a.review_status === "PENDING")
                        .map(
                          (a) =>
                            `${a.attendance_date} · Menunggu tinjauan admin`,
                        ),
                    },
                  ]}
                />
                {shift}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {agenda}
                {profile}
              </div>
            </>
          ) : production ? (
            <div className="grid lg:grid-cols-2 gap-4">
              {agenda}
              {profile}
            </div>
          ) : (
            <>
              <div className="grid lg:grid-cols-2 gap-4">
                {shift}
                {agenda}
              </div>
              {profile}
            </>
          )}
        </>
      )}
    </div>
  )
}
