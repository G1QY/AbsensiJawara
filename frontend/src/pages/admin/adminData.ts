export interface Branch {
  id: string
  code: string
  name: string
}
export interface Store {
  location_kind?: "STORE" | "OFFICE"
  id: string
  code: string
  name: string
  branch_id: string | null
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  status: string
}
export interface Event {
  id: string
  event_code: string
  event_name: string
  client_name: string
  branch_id: string | null
  event_date: string
  status: string
}
export interface Directory {
  branches: Branch[]
  stores: Store[]
  events: Event[]
}
export interface Crew {
  id: string
  employee_code: string
  crew_type: "CREW_EVENT" | "CREW_STORE"
  status: "ACTIVE" | "INACTIVE"
  base_salary: number
  branch_id: string | null
  branch: { id: string; name: string } | null
  avatarUrl?: string
  user: { id: string; full_name: string; email: string; phone_number: string }
  store_assignments: {
    id: string
    status: string
    start_date: string
    end_date: string | null
    store: Pick<Store, "id" | "name" | "branch_id"> | null
  }[]
  event_assignments: {
    id: string
    status: string
    position: string
    event: Pick<Event, "id" | "event_code" | "event_name" | "event_date" | "status" | "branch_id"> | null
  }[]
}
export const money = (n: number) => "Rp" + Number(n).toLocaleString("id-ID")
export const crewKind = (c: Crew) =>
  c.crew_type === "CREW_STORE" ? "Crew Store" : "Crew Event"
export const eventCount = (c: Crew) =>
  new Set((c.event_assignments || []).map((a) => a.event?.id).filter(Boolean))
    .size
export function sources(c: Crew): string[] {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date())
  return c.crew_type === "CREW_STORE"
    ? [
        ...new Set(
          (c.store_assignments || [])
            .filter(
              (a) =>
                a.status === "ACTIVE" &&
                a.start_date <= today &&
                (!a.end_date || a.end_date >= today),
            )
            .map((a) => a.store?.name)
            .filter((s): s is string => !!s),
        ),
      ]
    : [
        ...new Set(
          (c.event_assignments || [])
            .filter(
              (a) =>
                a.status === "ACTIVE" &&
                ["SCHEDULED", "ONGOING"].includes(a.event?.status || ""),
            )
            .map((a) => a.event?.event_name)
            .filter((s): s is string => !!s),
        ),
      ]
}
export const control =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
export const button =
  "px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
export const primary =
  "px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
export const panel = "bg-white rounded-2xl border border-slate-200 p-5"
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Permintaan gagal. Coba lagi."
