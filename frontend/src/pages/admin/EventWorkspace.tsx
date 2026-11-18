import { t as translateUI } from "../../lib/i18n";
import { branchLabel } from "../../lib/locationLabel";
import EventResults, { EventPhoto } from "../../components/events/EventResults";
import { exportEventPDF } from "../crewEvent/EventWorkflow";
import type {
  CrewEventAssignment,
  WorkflowState,
} from "../crewEvent/crewEventWorkspace";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/apiClient";
import Modal from "../../components/ui/Modal";
import {
  type Crew,
  type Directory,
  type Event,
  button,
  primary,
  control,
  panel,
  message,
  money,
} from "./adminData";
import { DataTable, EventBadge, Stat } from "./adminWidgets";
import { downloadWorkbook } from "../../lib/xlsxExport";
import { stamp, reviewLabel } from "./attendanceData";
import EventBreakSchedule from '../../components/attendance/EventBreakSchedule';
import EventPayrollPanel from "../payroll/EventPayrollPanel";
import OpenStreetMapLocationPicker from "../../components/maps/OpenStreetMapLocationPicker";
export interface ManagedEvent extends Event {
  start_time: string | null;
  end_time: string | null;
  pic_crew_id: string | null;
  updated_at: string;
  overtime_preapproved: boolean;
  branch: { name: string; city_name?: string } | null;
  pic: { user: { full_name: string } } | null;
  event_locations: {
    id: string;
    address: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
  }[];
  event_assignments: {
    id: string;
    crew_id: string;
    position: string;
    status: string;
    crew: {
      id: string;
      company_name?: string;
      job_title?: string;
      employee_code: string;
      crew_type: string;
      base_salary: number;
      user: { full_name: string; email: string };
    };
    event_schedules: {
      break_start_time?:string|null;break_end_time?:string|null;
      id: string;
      schedule_date: string;
      start_time: string;
      end_time: string;
      overtime_preapproved: boolean;
    }[];
  }[];
  attendance?: {
    id: string;
    crew_id: string;
    attendance_date: string;
    check_in: string | null;
    check_out: string | null;
    check_in_photo_url?: string | null;
    check_out_photo_url?: string | null;
    dead_device_photo_url?: string | null;
    status: string;
    review_status: string;
    late_minutes: number;
    overtime_minutes: number;
    overtime_status: string;
    check_in_note: string;
    check_out_note: string;
  }[];
  workflow?: WorkflowState;
  audit?: {
    id: string;
    action: string;
    actor_name?: string;
    subject_name?: string;
    created_at: string;
  }[];
}
const empty = {
  company_name: "",
  event_code: "",
  event_name: "",
  client_name: "",
  branch_id: "",
  event_date: "",
  start_time: "",
  end_time: "",
  status: "SCHEDULED",
  pic_crew_id: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: "50",
  overtime_preapproved: false,
};
export const eventHours = (e: ManagedEvent) =>
  e.start_time && e.end_time
    ? `${e.start_time.slice(0, 5)} – ${e.end_time.slice(0, 5)} WIB${e.end_time <= e.start_time ? " (+1 hari)" : ""}`
    : "Jadwal belum lengkap";
export default function EventWorkspace({
  onAttendance,
  onPayroll,
}: {
  onAttendance: () => void;
  onPayroll?: () => void;
}) {
  const [events, setEvents] = useState<ManagedEvent[]>([]),
    [crew, setCrew] = useState<Crew[]>([]),
    [directory, setDirectory] = useState<Directory>({
      branches: [],
      stores: [],
      events: [],
    });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [formError, setFormError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [detail, setDetail] = useState<ManagedEvent | null>(null),
    [tab, setTab] = useState("Overview");
  const [showForm, setShowForm] = useState(false),
    [editing, setEditing] = useState<ManagedEvent | null>(null),
    [form, setForm] = useState(empty),
    [assignCrew, setAssignCrew] = useState(""),
    [position, setPosition] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [e, c, d] = await Promise.all([
        api.get<ManagedEvent[]>("/admin-events"),
        api.get<Crew[]>("/crew"),
        api.get<Directory>("/admin-directory"),
      ]);
      setEvents(e);
      setCrew(c);
      setDirectory(d);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    let active = true;
    const refresh = () =>
      api
        .get<ManagedEvent[]>("/admin-events")
        .then((rows) => {
          if (active) setEvents(rows);
        })
        .catch(() => {});
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!detail?.id) return;
    const id = detail.id;
    let active = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const row = await api.get<ManagedEvent>(`/admin-events/${id}`);
        if (active)
          setDetail((current) => (current?.id === id ? row : current));
      } catch (reason) {
        if (active) setError("Detail belum diperbarui: " + message(reason));
      } finally {
        running = false;
      }
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [detail?.id]);
  async function openDetail(e: ManagedEvent) {
    setBusy(true);
    setError("");
    try {
      setDetail(await api.get<ManagedEvent>(`/admin-events/${e.id}`));
      setTab("Overview");
      setAssignCrew("");
      setPosition("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function openForm(e?: ManagedEvent) {
    setEditing(e || null);
    setFormError("");
    const l = e?.event_locations[0];
    setForm(
      e
        ? {
            company_name: e.company_name || "",
            event_code: e.event_code,
            event_name: e.event_name,
            client_name: e.client_name || "",
            branch_id: e.branch_id || "",
            event_date: e.event_date,
            start_time: e.start_time?.slice(0, 5) || "",
            end_time: e.end_time?.slice(0, 5) || "",
            status: e.status,
            pic_crew_id: e.pic_crew_id || "",
            address: l?.address || "",
            latitude: l ? String(l.latitude) : "",
            longitude: l ? String(l.longitude) : "",
            radius_meters: l ? String(l.radius_meters) : "50",
            overtime_preapproved: !!e.overtime_preapproved,
          }
        : { ...empty },
    );
    setShowForm(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    let committed = false;
    try {
      if (
        !form.address.trim() ||
        !form.latitude.trim() ||
        !form.longitude.trim()
      )
        throw new Error("Pilih lokasi event melalui Google Maps.");
      if (form.start_time >= form.end_time)
        throw new Error(
          "Jam selesai harus setelah jam mulai pada tanggal yang sama.",
        );
      const body = {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
        pic_crew_id: form.pic_crew_id || null,
        ...(editing ? { expected_updated_at: editing.updated_at } : {}),
      };
      const saved = editing
        ? await api.patch<{ id: string }>(`/admin-events/${editing.id}`, body)
        : await api.post<{ id: string }>("/admin-events", body);
      committed = true;
      setShowForm(false);
      setNotice(
        "Event dan lokasi tersimpan. Jadwal dibuat jika ada penugasan aktif.",
      );
      await load();
      if (detail?.id === saved.id)
        setDetail(await api.get<ManagedEvent>(`/admin-events/${saved.id}`));
    } catch (e) {
      if (committed)
        setError(
          "Perubahan tersimpan, tetapi detail belum termuat: " + message(e),
        );
      else setFormError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function assign(cId: string, pos: string, next = "ACTIVE") {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin-events/${detail.id}/crew`, {
        crewId: cId,
        position: pos,
        status: next,
      });
      setDetail(await api.get<ManagedEvent>(`/admin-events/${detail.id}`));
      setAssignCrew("");
      setPosition("");
      setNotice(
        next === "ACTIVE"
          ? "Crew ditugaskan dan jadwal absensi dibuat."
          : "Penugasan diakhiri. Riwayat tetap tersimpan.",
      );
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const list = events.filter(
    (e) =>
      (!status || e.status === status) &&
      [
        e.company_name || "Belum diisi",
        e.event_name,
        branchLabel(e.branch),
        e.event_locations[0]?.address,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const active =
    detail?.event_assignments.filter((a) => a.status === "ACTIVE") || [];
  const present = new Set(
    detail?.attendance
      ?.filter((a) => a.check_in && a.review_status !== "REJECTED")
      .map((a) => a.crew_id) || [],
  );
  const exportEvents = (items: ManagedEvent[]) =>
    downloadWorkbook(
      [
        [
          "Perusahaan",
          "Nama Event",
          "Kota / Cabang",
          "Tanggal",
          "Jam",
          "Lokasi",
          "PIC",
          "Crew Aktif",
          "Status",
        ],
        ...items.map((e) => [
          e.company_name || "Belum diisi",
          e.event_name,
          branchLabel(e.branch),
          e.event_date,
          eventHours(e),
          e.event_locations[0]?.address || "",
          e.pic?.user.full_name || "",
          new Set(e.event_assignments.filter((a) => e.status === "COMPLETED" || a.status === "ACTIVE").map(a => a.crew_id)).size,
          e.status,
        ]),
      ],
      "Event-JAWARA.xlsx",
    );
  const role = (a: ManagedEvent["event_assignments"][number]) =>
    [detail?.pic_crew_id === a.crew_id ? "PIC" : "", a.position]
      .filter(Boolean)
      .join(" • ") || "Crew";
  async function exportPdf() {
    if (!detail) return;
    setBusy(true);
    try {
      const assignment: CrewEventAssignment = {
        id: detail.event_assignments[0]?.id || detail.id,
        position: null,
        status: "ACTIVE",
        event: detail as CrewEventAssignment["event"],
        event_schedules:
          detail.start_time && detail.end_time
            ? [
                {
                  id: detail.id,
                  schedule_date: detail.event_date,
                  start_time: detail.start_time,
                  end_time: detail.end_time,
                  status: "ACTIVE",
                },
              ]
            : [],
        workflow: detail.workflow || {
          event_id: detail.id,
          data: {},
          current_step: 1,
          max_reached: 1,
          updated_at: null,
        },
        team: active.map((a) => a.crew.user.full_name),
        members: detail.event_assignments.map((a) => ({
          id: a.id,
          crew_id: a.crew_id,
          name: a.crew.user.full_name,
          company_name: a.crew.company_name,
          job_title: a.crew.job_title,
          position: a.position,
          status: a.status,
        })),
        attendance: detail.attendance || [],
      };
      await exportEventPDF(
        assignment,
        assignment.workflow.data,
        true,
        "/admin-events",
      );
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {error && (
        <p role="alert" className="ui-error p-4 rounded-xl">
          {translateUI(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="ui-success p-4 rounded-xl text-sm">
          {translateUI(notice)}
        </p>
      )}
      {detail ? (
        <>
          <div className={panel + " flex flex-wrap justify-between gap-4"}>
            <div>
              <button
                className="text-xs text-blue-700 mb-3"
                onClick={() => setDetail(null)}
              >
                {translateUI("← Kembali ke Kelola Event")}
              </button>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                  {detail.company_name ||
                    translateUI("Perusahaan belum ditetapkan")}
                </span>
                <EventBadge status={detail.status} />
              </div>
              <h2 className="font-bold text-lg text-slate-900 mt-2">
                {detail.event_name}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {detail.event_locations[0]?.address || "Lokasi belum diisi"} •{" "}
                {detail.event_date} • {eventHours(detail)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-start">
              <button
                className={button}
                disabled={busy}
                onClick={() => openForm(detail)}
              >
                {translateUI("Edit Event")}
              </button>
              <button className={button} onClick={() => exportEvents([detail])}>
                {translateUI("Export Excel")}
              </button>
              <button
                disabled={busy}
                className={primary}
                onClick={() => void exportPdf()}
              >
                {busy ? translateUI("Memproses…") : translateUI("Export PDF")}
              </button>
            </div>
          </div>
          <div className={panel + " !p-0 overflow-hidden"}>
            <div
              className="flex overflow-x-auto border-b border-slate-200 px-3"
              role="tablist"
              aria-label={translateUI("Detail event")}
            >
              {[
                "Overview",
                "Crew",
                "Absensi",
                "Inventory",
                "Operasional",
                "Payroll",
                "Audit Log",
              ].map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  key={t}
                  className={
                    "p-4 text-xs whitespace-nowrap border-b-2 " +
                    (tab === t
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-slate-500")
                  }
                  onClick={() => setTab(t)}
                >
                  {translateUI(t)}
                </button>
              ))}
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {tab === "Overview" && (
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-5">
                    <dl className="grid grid-cols-[110px_1fr] gap-5 text-sm">
                      {[
                        ["Nama Event", detail.event_name],
                        ["Klien", detail.client_name || translateUI("Belum diisi")],
                        [
                          "Progres Workflow",
                          `${detail.workflow?.current_step || 1}/15`,
                        ],
                        ["ID Event", detail.event_code],
                        ["Tanggal", detail.event_date],
                        ["Jam", eventHours(detail)],
                        [
                          "Lokasi",
                          detail.event_locations[0]?.address || translateUI("Belum diisi"),
                        ],
                        ["Cabang", branchLabel(detail.branch) || translateUI("Belum diisi")],
                        [
                          "PIC",
                          detail.pic?.user.full_name || translateUI("Belum ditetapkan"),
                        ],
                        [
                          "Lembur",
                          detail.overtime_preapproved
                            ? translateUI("Disetujui dari jadwal")
                            : translateUI("Perlu persetujuan admin"),
                        ],
                      ].map(([k, v]) => (
                        <div className="contents" key={k}>
                          <dt className="text-slate-500">{translateUI(k)}</dt>
                          <dd className="text-slate-900 break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex justify-between">
                      {translateUI("Status Event")}
                      <EventBadge status={detail.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Stat
                        label={translateUI("Total Crew Aktif")}
                        value={active.length}
                        tone="plain"
                      />
                      <Stat
                        label={translateUI("Crew Hadir")}
                        value={
                          active.filter((a) => present.has(a.crew_id)).length
                        }
                        tone="plain"
                      />
                      <Stat
                        label={translateUI("Belum Clock In")}
                        value={
                          active.filter((a) => !present.has(a.crew_id)).length
                        }
                        tone="plain"
                      />
                    </div>
                  </div>
                </div>
              )}
              {tab === "Crew" && (
                <>
                  <form
                    className="grid sm:grid-cols-[1fr_1fr_auto] gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void assign(assignCrew, position);
                    }}
                  >
                    <select
                      aria-label={translateUI("Pilih crew event")}
                      required
                      className={control}
                      value={assignCrew}
                      onChange={(e) => setAssignCrew(e.target.value)}
                    >
                      <option value="">
                        {translateUI("Pilih crew event satu cabang")}
                      </option>
                      {crew
                        .filter(
                          (c) =>
                            c.crew_type === "CREW_EVENT" &&
                            c.status === "ACTIVE" &&
                            c.branch_id === detail.branch_id &&
                            !active.some((a) => a.crew_id === c.id),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.user.full_name}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label={translateUI("Posisi penugasan")}
                      required
                      className={control}
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      <option value="">{translateUI("Pilih tugas")}</option>
                      <option value="Tenda">{translateUI("Tenda")}</option>
                      <option value="Fotobox">Fotobox</option>
                    </select>
                    <button disabled={busy} className={primary}>
                      {translateUI("Tugaskan Crew")}
                    </button>
                  </form>
                  <DataTable
                    headers={[
                      "Crew",
                      "Perusahaan",
                      "Jabatan",
                      "Email",
                      "Tugas Event",
                      "Jadwal WIB",
                      "Status",
                      "Aksi",
                    ]}
                    rows={detail.event_assignments.map((a) => [
                      a.crew.user.full_name,
                      a.crew.company_name || "Belum diisi",
                      a.crew.job_title || "Belum diisi",
                      a.crew.user.email,
                      role(a),
                      a.event_schedules.length ? <div className="space-y-3">{a.event_schedules.map(s=><div key={s.id}><p>{s.schedule_date} {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</p><EventBreakSchedule key={s.id+String(s.break_start_time)+String(s.break_end_time)} eventId={detail.id} schedule={s} onSaved={()=>void openDetail(detail)}/></div>)}</div> : "Belum dibuat",
                      translateUI(a.status),
                      a.status === "ACTIVE" ? (
                        <button
                          className="text-red-700"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Akhiri penugasan crew? Riwayat tetap disimpan.",
                              )
                            )
                              void assign(a.crew_id, a.position, "ENDED");
                          }}
                        >
                          {translateUI("Akhiri penugasan")}
                        </button>
                      ) : (
                        translateUI("Selesai")
                      ),
                    ])}
                  />
                </>
              )}
              {tab === "Absensi" && (
                <>
                  <p className="text-sm text-slate-600">
                    {translateUI(
                      "Jadwal di tab Crew menjadi acuan halaman absensi crew event. Tinjau foto dan persetujuan melalui Manajemen Absensi.",
                    )}
                  </p>
                  <button className={button} onClick={onAttendance}>
                    {translateUI("Buka Manajemen Absensi")}
                  </button>
                  <DataTable
                    headers={[
                      "Crew",
                      "Tanggal",
                      "Clock In",
                      "Clock Out",
                      "Status",
                      "Persetujuan",
                      "Catatan",
                    ]}
                    rows={(detail.attendance || []).map((a) => [
                      detail.event_assignments.find(
                        (c) => c.crew_id === a.crew_id,
                      )?.crew.user.full_name || "Crew",
                      a.attendance_date,
                      stamp(a.check_in),
                      stamp(a.check_out),
                      a.status,
                      reviewLabel(a.review_status),
                      [a.check_in_note, a.check_out_note]
                        .filter(Boolean)
                        .join(" / ") || "Tidak ada catatan",
                    ])}
                  />
                </>
              )}
              {tab === "Absensi" && (
                <div className="space-y-4">
                  {detail.event_assignments.map((a) => {
                    const log = detail.attendance?.find(
                      (log) => log.crew_id === a.crew_id,
                    );
                    return (
                      <section key={a.id} className="rounded-xl border p-4">
                        <h3 className="font-semibold mb-3">
                          {a.crew.user.full_name}
                        </h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            ["Clock In", log?.check_in_photo_url],
                            [
                              "Setup Ready",
                              detail.workflow?.data[
                                `setup_ready_photo_${a.id}`
                              ],
                            ],
                            [
                              "Selesai Event",
                              detail.workflow?.data[
                                `event_finished_photo_${a.id}`
                              ],
                            ],
                            ...(log?.dead_device_photo_url ? [["Bukti Matikan Device", log.dead_device_photo_url]] : []),
                            ["Clock Out", log?.check_out_photo_url],
                          ].map(([label, value]) => (
                            <EventPhoto
                              key={label}
                              eventId={detail.id}
                              value={value}
                              label={label || ""}
                              admin
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              {tab === "Audit Log" && (
                <DataTable
                  headers={["Waktu WIB", "Pelaku", "Tindakan", "Crew / Data"]}
                  rows={(detail.audit || []).map((a) => [
                    stamp(a.created_at),
                    a.actor_name || "Pengguna tidak tersedia",
                    a.action,
                    a.subject_name || detail.event_name,
                  ])}
                />
              )}
              {tab === "Payroll" && (
                <>
                  <div className="flex flex-wrap justify-between gap-3 items-center">
                    <p className="text-sm text-slate-600">
                      {translateUI(
                        "Fee dan penyesuaian mengikuti payroll tersimpan untuk event ini.",
                      )}
                    </p>
                    {onPayroll && <button className={button} onClick={onPayroll}>
                      {translateUI("Buka Payroll Semua Crew")}
                    </button>}
                  </div>
                  <EventPayrollPanel eventId={detail.id} month={detail.event_date.slice(0,7)} />
                </>
              )}
              {["Inventory", "Operasional"].includes(tab) && (
                <EventResults
                  eventId={detail.id}
                  eventName={detail.event_name}
                  eventDate={detail.event_date}
                  data={detail.workflow?.data || {}}
                  tab={tab as "Inventory" | "Operasional"}
                  context={{
                    Perusahaan: detail.company_name || "",
                    Cabang: branchLabel(detail.branch),
                  }}
                  admin
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {translateUI("Kelola Event")}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  {translateUI("Event, lokasi, PIC, crew, dan jadwal absensi.")}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <button
                  className={`${button} text-center justify-center flex items-center text-xs sm:text-sm py-2 px-3`}
                  disabled={loading}
                  onClick={() => void load()}
                >
                  {translateUI("Muat ulang")}
                </button>
                <button
                  className={`${primary} text-center justify-center flex items-center text-xs sm:text-sm py-2 px-3.5`}
                  onClick={() => openForm()}
                >
                  {translateUI("+ Tambah Event")}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className={`${control} flex-1`}
                aria-label={translateUI("Cari event")}
                placeholder={translateUI("Cari nama, perusahaan, cabang, lokasi...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <select
                  className={`${control} sm:!w-auto`}
                  aria-label={translateUI("Filter status event")}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{translateUI("Semua status")}</option>
                  {["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"].map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
                <button
                  className={`${button} flex items-center justify-center gap-1.5 text-xs sm:text-sm py-2 px-3`}
                  disabled={loading || !!error || !list.length}
                  onClick={() => exportEvents(list)}
                >
                  <svg className="w-4 h-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <span>{translateUI("Export Excel")}</span>
                </button>
              </div>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500 py-6 text-center">{translateUI("Memuat event...")}</p>
          ) : !list.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              {translateUI("Belum ada data yang sesuai.")}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {/* Mobile Card List (< sm) */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {list.map((e) => {
                  const assignedCount = new Set(
                    e.event_assignments
                      .filter((a) => e.status === "COMPLETED" || a.status === "ACTIVE")
                      .map((a) => a.crew_id)
                  ).size;
                  return (
                    <article key={e.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-blue-700 truncate">
                            {e.company_name || translateUI("Belum diisi")}
                          </p>
                          <h3 className="text-base font-bold text-slate-900 mt-0.5 break-words">
                            {e.event_name}
                          </h3>
                        </div>
                        <EventBadge status={e.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <div>
                          <span className="block text-[10px] text-slate-500 uppercase tracking-wider">{translateUI("Tanggal & Jam")}</span>
                          <span className="font-medium text-slate-900">{e.event_date}</span>
                          <span className="block text-slate-600 font-mono mt-0.5">{eventHours(e)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-500 uppercase tracking-wider">{translateUI("PIC & Crew")}</span>
                          <span className="font-medium text-slate-900 truncate block">{e.pic?.user.full_name || translateUI("Belum ada PIC")}</span>
                          <span className="text-slate-600 mt-0.5 block">{assignedCount} {translateUI("crew")}</span>
                        </div>
                      </div>

                      {e.event_locations[0]?.address && (
                        <p className="text-xs text-slate-500 truncate">
                          📍 {e.event_locations[0].address}
                        </p>
                      )}

                      <div className="pt-1">
                        <button
                          disabled={busy}
                          className="w-full py-2 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 text-center"
                          onClick={() => void openDetail(e)}
                        >
                          {translateUI("Lihat Detail & Absensi →")}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop Table (>= sm) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs bg-slate-50 text-slate-500">
                    <tr>
                      {["Perusahaan", "Nama Event", "Tanggal", "Jam", "Lokasi", "PIC", "Crew", "Status", "Aksi"].map(
                        (h) => (
                          <th key={h} className="text-left p-4 whitespace-nowrap">
                            {translateUI(h)}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60">
                        <td className="p-4 text-slate-700">
                          <span className="text-blue-700 text-xs font-medium">
                            {e.company_name || translateUI("Belum diisi")}
                          </span>
                        </td>
                        <td className="p-4 text-slate-900 font-semibold">{e.event_name}</td>
                        <td className="p-4 text-slate-700 whitespace-nowrap">{e.event_date}</td>
                        <td className="p-4 text-slate-700 whitespace-nowrap font-mono text-xs">{eventHours(e)}</td>
                        <td className="p-4 text-slate-700 max-w-48 truncate" title={e.event_locations[0]?.address || "Belum diisi"}>
                          {e.event_locations[0]?.address || "Belum diisi"}
                        </td>
                        <td className="p-4 text-slate-700 whitespace-nowrap">{e.pic?.user.full_name || "Belum ditetapkan"}</td>
                        <td className="p-4 text-slate-700 text-center font-semibold">
                          {new Set(e.event_assignments.filter((a) => e.status === "COMPLETED" || a.status === "ACTIVE").map(a => a.crew_id)).size}
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <EventBadge status={e.status} />
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <button
                            disabled={busy}
                            className="text-blue-700 font-semibold hover:underline"
                            onClick={() => void openDetail(e)}
                          >
                            {translateUI("Detail")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      <Modal
        open={showForm}
        onClose={() => {
          if (!busy) setShowForm(false);
        }}
        title={
          editing ? translateUI("Edit Event") : translateUI("Tambah Event")
        }
        size="lg"
      >
        <form className="space-y-4" onSubmit={save}>
          {formError && (
            <p role="alert" className="ui-error p-3 rounded-xl">
              {formError}
            </p>
          )}
          <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-4">
            {(
              [
                "company_name",
                "event_name",
                "event_date",
                "start_time",
                "end_time",
                "client_name",
              ] as const
            ).map((k) => (
              <label key={k} className="text-xs text-slate-600">
                {
                  {
                    company_name: "Perusahaan",
                    event_name: "Nama Event",
                    event_date: "Tanggal Event",
                    start_time: "Jam Mulai (WIB)",
                    end_time: "Jam Selesai (WIB)",
                    client_name: "Nama Klien",
                  }[k]
                }
                <input
                  required={k !== "client_name" && k !== "company_name"}
                  type={
                    k === "event_date"
                      ? "date"
                      : k.endsWith("_time")
                        ? "time"
                        : "text"
                  }
                  maxLength={150}
                  className={control}
                  value={form[k]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [k]: e.target.value }))
                  }
                />
              </label>
            ))}
            <div className="sm:col-span-2">
              <OpenStreetMapLocationPicker
                address={form.address}
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(location) => setForm((f) => ({ ...f, ...location }))}
              />
            </div>
            <label className="text-xs text-slate-600">
              {translateUI("Radius GPS (meter)")}
              <input
                required
                type="number"
                min="1"
                max="10000"
                className={control}
                value={form.radius_meters}
                onChange={(e) =>
                  setForm((f) => ({ ...f, radius_meters: e.target.value }))
                }
              />
            </label>
            <label className="text-xs text-slate-600">
              {translateUI("Kota / Cabang")}
              <select
                required
                className={control}
                value={form.branch_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    branch_id: e.target.value,
                    pic_crew_id: "",
                  }))
                }
              >
                <option value="">{translateUI("Pilih cabang")}</option>
                {directory.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              {translateUI("PIC Event")}
              <select
                className={control}
                value={form.pic_crew_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pic_crew_id: e.target.value }))
                }
              >
                <option value="">{translateUI("Belum ditetapkan")}</option>
                {crew
                  .filter(
                    (c) =>
                      c.crew_type === "CREW_EVENT" &&
                      c.status === "ACTIVE" &&
                      c.branch_id === form.branch_id,
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.user.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Status
              <select
                className={control}
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                {[
                  "DRAFT",
                  "SCHEDULED",
                  "ONGOING",
                  "COMPLETED",
                  "CANCELLED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <input
                aria-label={translateUI("Setujui lembur event dari jadwal")}
                type="checkbox"
                className="mt-1"
                checked={form.overtime_preapproved}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    overtime_preapproved: e.target.checked,
                  }))
                }
              />
              <span>
                <strong>
                  {translateUI("Setujui lembur dari jadwal event")}
                </strong>
                <small className="block mt-1">
                  {translateUI(
                    "Jam penuh setelah event selesai otomatis disetujui. Tanpa pilihan ini, kelebihan waktu menunggu keputusan admin.",
                  )}
                </small>
              </span>
            </label>
          </fieldset>
          <p className="text-xs text-slate-500">
            {translateUI(
              "Form ini mendukung event satu hari, dengan jam selesai setelah jam mulai. Satu crew hanya boleh memiliki satu event aktif per tanggal. PIC tidak otomatis ditugaskan untuk absen; tambahkan lewat tab Crew. Simpan membuat jadwal untuk penugasan aktif. Jadwal/lokasi yang sudah dipakai absensi tidak dapat diubah di sini.",
            )}
          </p>
          <button className={primary} disabled={busy}>
            {busy ? translateUI("Menyimpan...") : translateUI("Simpan Event")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
