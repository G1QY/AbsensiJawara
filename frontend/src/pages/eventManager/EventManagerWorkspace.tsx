import { useEffect, useState } from "react"
import { api } from "../../lib/apiClient"
import {
  button,
  primary,
  control,
  panel,
  message,
  type Crew,
} from "../admin/adminData"
import { type ManagedEvent, eventHours } from "../admin/EventWorkspace"
import { MiniChart, Stat, EventBadge } from "../admin/adminWidgets"
import {
  wibDate,
  type RegisteredAttendance,
  type ServerGuest,
} from "../admin/attendanceData"
import ExportButtons from "../../components/ui/ExportButtons"

const assignedCrew = (event: ManagedEvent) =>
  new Set(event.event_assignments.filter(a => ["COMPLETED", "CANCELLED"].includes(event.status) || a.status === "ACTIVE").map((a) => a.crew_id)).size
const title: Record<string, string> = {
  "em-dashboard": "Dashboard Event",
  "em-crew": "Crew Event",
  "em-reports": "Rekap Event",
}

export default function EventManagerWorkspace({
  page,
  onNavigate,
}: {
  page: string
  onNavigate: (page: string) => void
}) {
  const [data, setData] = useState<{
    crew: Crew[]
    events: ManagedEvent[]
    registered: RegisteredAttendance[]
    guest: ServerGuest[]
  } | null>(null)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState("")
  async function load() {
    setLoading(true)
    setError("")
    try {
      const [crew, events, attendance] = await Promise.all([
        api.get<Crew[]>("/crew"),
        api.get<ManagedEvent[]>("/admin-events"),
        api.get<{ registered: RegisteredAttendance[]; guest: ServerGuest[] }>(
          "/admin-attendance",
        ),
      ])
      setData({ crew, events, ...attendance })
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  const today = wibDate(),
    month = today.slice(0, 7)
  const events = data?.events || [],
    crew = data?.crew || []
  const current = events.filter((e) => e.event_date.startsWith(month))
  const upcoming = events
    .filter((e) => ["SCHEDULED", "ONGOING"].includes(e.status))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
  const pending =
    (data?.registered || []).filter((a) =>
      ["PENDING", "NOT_REQUIRED"].includes(a.review_status),
    ).length +
    (data?.guest || []).filter((a) =>
      ["PENDING", "NOT_REQUIRED"].includes(a.review_status),
    ).length
  const q = search.trim().toLowerCase()
  const roster = crew.filter((c) =>
    [c.user.full_name, c.user.email, c.employee_code, c.branch?.city_name]
      .join(" ")
      .toLowerCase()
      .includes(q),
  )
  const reports = events.filter((e) =>
    [e.event_name, e.event_date, e.branch?.city_name, e.status]
      .join(" ")
      .toLowerCase()
      .includes(q),
  )
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap justify-between gap-3 items-center">
        <div>
          <p className="text-sm text-violet-700 font-semibold">Event Manager</p>
          <h1 className="text-xl font-bold mt-1">
            {title[page] || title["em-dashboard"]}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Event, penugasan crew, dan tinjauan kehadiran.
          </p>
        </div>
        <button
          disabled={loading}
          className={button}
          onClick={() => void load()}
        >
          Muat ulang
        </button>
      </header>
      {error && (
        <p role="alert" className="ui-error p-4 rounded-xl">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Memuat data event...</p>
      ) : (
        !error &&
        data && (
          <>
            {page === "em-dashboard" && (
              <>
                <section className="rounded-2xl bg-violet-700 text-white p-5 sm:p-7 flex flex-wrap justify-between gap-5 items-center">
                  <div>
                    <p className="text-sm text-violet-100">
                      Operasional event · {today} WIB
                    </p>
                    <h2 className="text-2xl font-bold mt-2">
                      {upcoming.filter((e) => e.status === "ONGOING").length}{" "}
                      event sedang berlangsung
                    </h2>
                    <p className="text-sm text-violet-100 mt-2">
                      {pending} catatan kehadiran perlu ditinjau.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl bg-white text-violet-800 px-4 py-2.5 font-semibold"
                      onClick={() => onNavigate("em-events")}
                    >
                      Kelola Event
                    </button>
                    <button
                      className="rounded-xl border border-violet-300 px-4 py-2.5 font-semibold"
                      onClick={() => onNavigate("em-attendance")}
                    >
                      Tinjau Absensi Event
                    </button>
                  </div>
                </section>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <Stat
                    label="Event bulan ini"
                    value={
                      current.filter((e) => e.status !== "CANCELLED").length
                    }
                    sub={month}
                    tone="plain"
                  />
                  <Stat
                    label="Crew event aktif"
                    value={crew.filter((c) => c.status === "ACTIVE").length}
                    tone="plain"
                  />
                  <Stat
                    label="Event selesai"
                    value={
                      current.filter((e) => e.status === "COMPLETED").length
                    }
                    sub={month}
                    tone="plain"
                  />
                  <Stat
                    label="Perlu tinjauan"
                    value={pending}
                    sub="Absensi crew dan guest event"
                    tone="plain"
                  />
                </div>
                <div className="grid lg:grid-cols-2 gap-4">
                  <MiniChart
                    title="Status Event Bulan Ini"
                    subtitle={month}
                    color="#7c3aed"
                    points={[
                      "DRAFT",
                      "SCHEDULED",
                      "ONGOING",
                      "COMPLETED",
                      "CANCELLED",
                    ].map((status) => ({
                      label: ({
                        DRAFT: "Draft",
                        SCHEDULED: "Terjadwal",
                        ONGOING: "Berlangsung",
                        COMPLETED: "Selesai",
                        CANCELLED: "Batal",
                      } as Record<string, string>)[status],
                      value: current.filter((e) => e.status === status).length,
                      details: current
                        .filter((e) => e.status === status)
                        .map((e) => `${e.event_date} · ${e.event_name}`),
                    }))}
                  />
                  <section className={panel}>
                    <h2 className="font-semibold">Agenda Event</h2>
                    <div className="divide-y divide-slate-100 mt-3">
                      {upcoming.slice(0, 5).map((e) => (
                        <article
                          key={e.id}
                          className="py-3 flex justify-between items-start gap-3"
                        >
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm break-words">
                              {e.event_name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              {e.event_date} · {eventHours(e)}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {assignedCrew(e)} crew ·{" "}
                              {e.branch?.city_name || "Cabang belum diisi"}
                            </p>
                          </div>
                          <EventBadge status={e.status} />
                        </article>
                      ))}
                    </div>
                    {!upcoming.length && (
                      <p className="text-sm text-slate-500 mt-4">
                        Belum ada agenda event aktif.
                      </p>
                    )}
                    <button
                      className={button + " mt-4"}
                      onClick={() => onNavigate("em-events")}
                    >
                      Buka daftar event
                    </button>
                  </section>
                </div>
              </>
            )}
            {page === "em-crew" && (
              <>
                <input
                  className={control}
                  aria-label="Cari crew event"
                  placeholder="Cari nama, email, kode, atau kota..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <p className="text-sm text-slate-600">
                  {roster.length} crew. Atur penugasan dan PIC melalui Kelola
                  Event.
                </p>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {roster.map((c) => (
                    <article className={panel + " space-y-3"} key={c.id}>
                      <div className="flex justify-between items-start gap-2">
                        <h2 className="font-semibold break-words">
                          {c.user.full_name}
                        </h2>
                        <span className="text-xs text-slate-500 shrink-0">
                          {c.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 break-all">
                        {c.user.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.employee_code} ·{" "}
                        {c.branch?.city_name || "Belum ada cabang"}
                      </p>
                      <p className="text-sm">
                        {c.event_assignments
                          .filter((a) => a.status === "ACTIVE")
                          .map((a) => a.event?.event_name)
                          .filter(Boolean)
                          .join(", ") || "Belum ditugaskan ke event aktif"}
                      </p>
                      <button
                        className={button}
                        onClick={() => onNavigate("em-events")}
                      >
                        Atur penugasan event
                      </button>
                    </article>
                  ))}
                </div>
                {!roster.length && (
                  <p className={panel}>
                    Tidak ada crew event sesuai pencarian.
                  </p>
                )}
              </>
            )}
            {page === "em-reports" && (
              <>
                <input
                  className={control}
                  aria-label="Cari rekap event"
                  placeholder="Cari event, tanggal, atau kota..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <ExportButtons
                  filename="Rekap-Event"
                  title="Rekap Event"
                  subtitle="Penugasan crew termasuk event selesai"
                  headers={[
                    "Event",
                    "Tanggal",
                    "Kota",
                    "PIC",
                    "Jumlah Crew",
                    "Status",
                  ]}
                  rows={reports.map((e) => [
                    e.event_name,
                    e.event_date,
                    e.branch?.city_name || "",
                    e.pic?.user.full_name || "",
                    assignedCrew(e),
                    e.status,
                  ])}
                />
                <div className="grid md:grid-cols-2 gap-4">
                  {reports.map((e) => (
                    <article key={e.id} className={panel + " space-y-3"}>
                      <div className="flex justify-between gap-3">
                        <h2 className="font-semibold break-words">
                          {e.event_name}
                        </h2>
                        <EventBadge status={e.status} />
                      </div>
                      <p className="text-sm text-slate-600">
                        {e.event_date} ·{" "}
                        {e.branch?.city_name || "Belum ada cabang"}
                      </p>
                      <p className="text-sm">
                        {assignedCrew(e)} crew · PIC:{" "}
                        {e.pic?.user.full_name || "Belum ditetapkan"}
                      </p>
                    </article>
                  ))}
                </div>
                {!reports.length && (
                  <p className={panel}>Tidak ada event sesuai pencarian.</p>
                )}
                <button
                  className={primary}
                  onClick={() => onNavigate("em-events")}
                >
                  Buka detail dan dokumentasi event
                </button>
              </>
            )}
          </>
        )
      )}
    </div>
  )
}
