import { useState, type FormEvent } from "react"
import { api } from "../../lib/apiClient"
import { type Directory, control, button, primary, message } from "./adminData"
import GoogleLocationPicker from "../../components/maps/GoogleLocationPicker"
type Kind = "branches" | "stores" | "events"
const blank = {
  code: "",
  name: "",
  branch_id: "",
  address: "",
  latitude: "",
  longitude: "",
  radius_meters: "50",
  status: "ACTIVE",
  event_date: "",
  client_name: "",
}
export default function DirectoryManager({
  data,
  onSaved,
  eventsOnly = false,
}: {
  data: Directory
  onSaved: () => Promise<void>
  eventsOnly?: boolean
}) {
  const [kind, setKind] = useState<Kind>(eventsOnly ? "events" : "stores")
  const [id, setId] = useState("")
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const change = (key: keyof typeof blank, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))
  function reset(next: Kind = kind) {
    setKind(next)
    setId("")
    setForm({ ...blank, status: next === "events" ? "SCHEDULED" : "ACTIVE" })
    setError("")
    setSuccess("")
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    setSuccess("")
    try {
      const body =
        kind === "branches"
          ? { code: form.code, name: form.name }
          : kind === "stores"
            ? {
              ...form,
              latitude: Number(form.latitude),
              longitude: Number(form.longitude),
              radius_meters: Number(form.radius_meters),
            }
            : {
              branch_id: form.branch_id,
              event_code: form.code,
              event_name: form.name,
              event_date: form.event_date,
              client_name: form.client_name,
              status: form.status === "ACTIVE" ? "SCHEDULED" : form.status,
            }
      if (
        kind === "stores" &&
        (!form.address.trim() || !form.latitude.trim() || !form.longitude.trim())
      )
        throw new Error("Pilih lokasi Store melalui Google Maps.")
      if (id) await api.patch(`/admin-directory/${kind}/${id}`, body)
      else await api.post(`/admin-directory/${kind}`, body)
      reset()
      setSuccess("Data tersimpan.")
      await onSaved()
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove(rowId: string, name: string) {
    if (!window.confirm(`Hapus ${kind === "branches" ? "cabang" : "store"} "${name}"? Data yang masih digunakan tidak dapat dihapus.`)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api.delete(`/admin-directory/${kind}/${rowId}`);
      if (id === rowId) reset();
      setSuccess("Data dihapus.");
      await onSaved();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  const rows = data[kind]
  return (
    <div className="space-y-4">
      {!eventsOnly && (
        <div className="flex flex-wrap gap-2">
          {(["branches", "stores"] as Kind[]).map((k) => (
            <button
              key={k}
              disabled={busy}
              className={kind === k ? primary : button}
              onClick={() => reset(k)}
            >
              {k === "branches" ? "Cabang" : "Store"}
            </button>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-600">
        {kind === "branches"
          ? "Cabang tidak dibatasi jumlahnya. Tambahkan kota/cabang baru saat JAWARA berkembang."
          : kind === "stores"
            ? "Pilih lokasi Store melalui Google Maps. Satu cabang dapat memiliki banyak Store."
            : "Daftar ini memakai event dari server. Penugasan Crew Event dan posisi dilakukan melalui Detail Event → Crew."}
      </p>
      <div className="max-h-48 overflow-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.id}
            className="p-3 flex gap-3 items-center justify-between text-sm"
          >
            <div>
              <p className="font-semibold text-slate-900">
                {"event_name" in row ? row.event_name : row.name}
              </p>
              <p className="text-xs text-slate-500">
                {"branch_id" in row
                  ? data.branches.find((b) => b.id === row.branch_id)?.name ||
                  "Cabang belum ditetapkan"
                  : row.code}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                disabled={busy}
                className={button}
                onClick={() => {
                  setId(row.id)
                  setError("")
                  setSuccess("")
                  setForm({
                    ...blank,
                    ...row,
                    code: "event_code" in row ? row.event_code : row.code,
                    name: "event_name" in row ? row.event_name : row.name,
                    branch_id: "branch_id" in row ? row.branch_id || "" : "",
                    latitude: "latitude" in row ? String(row.latitude) : "",
                    longitude: "longitude" in row ? String(row.longitude) : "",
                    radius_meters:
                      "radius_meters" in row ? String(row.radius_meters) : "50",
                  })
                }}
              >
                Edit
              </button>
              {kind !== "events" && <button type="button" disabled={busy} className={button + " text-red-700"}
                onClick={() => remove(row.id, "event_name" in row ? row.event_name : row.name)}>Hapus</button>}
            </div>
          </div>
        ))}
        {!rows.length && (
          <p className="p-4 text-sm text-slate-500">
            Belum ada data. Tambahkan melalui form di bawah.
          </p>
        )}
      </div>
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-semibold text-slate-900">
          {id ? "Edit" : "Tambah"}{" "}
          {kind === "branches"
            ? "Cabang"
            : kind === "stores"
              ? "Store"
              : "Event"}
        </h3>
        {error && (
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 p-3 rounded-xl"
          >
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-700">
            {success}
          </p>
        )}
        <fieldset
          disabled={busy}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <label className="text-sm text-slate-700">
            Kode
            <input
              required
              maxLength={30}
              className={control}
              value={form.code}
              onChange={(e) => change("code", e.target.value)}
            />
          </label>
          <label className="text-sm text-slate-700">
            Nama{" "}
            {kind === "branches"
              ? "Cabang"
              : kind === "stores"
                ? "Store"
                : "Event"}
            <input
              required
              maxLength={150}
              className={control}
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </label>
          {kind !== "branches" && (
            <label className="text-sm text-slate-700">
              Kantor Cabang
              <select
                aria-label="Kantor Cabang"
                required
                className={control}
                value={form.branch_id}
                onChange={(e) => change("branch_id", e.target.value)}
              >
                <option value="">Pilih cabang</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "stores" && (
            <>
              <div className="sm:col-span-2">
                <GoogleLocationPicker
                  title="Lokasi Store"
                  address={form.address}
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(location) => setForm((current) => ({ ...current, ...location }))}
                />
              </div>
              <label className="text-sm text-slate-700">
                Radius absensi (meter)
                <input
                  required
                  inputMode="numeric"
                  className={control}
                  value={form.radius_meters}
                  onChange={(e) => change("radius_meters", e.target.value)}
                />
              </label>
            </>
          )}
          {kind === "events" && (
            <>
              <label className="text-sm text-slate-700">
                Tanggal Event
                <input
                  required
                  type="date"
                  className={control}
                  value={form.event_date}
                  onChange={(e) => change("event_date", e.target.value)}
                />
              </label>
              <label className="text-sm text-slate-700">
                Nama Klien
                <input
                  className={control}
                  value={form.client_name}
                  onChange={(e) => change("client_name", e.target.value)}
                />
              </label>
            </>
          )}
          {kind !== "branches" && (
            <label className="text-sm text-slate-700">
              Status
              <select
                aria-label="Status"
                className={control}
                value={
                  kind === "events" && form.status === "ACTIVE"
                    ? "SCHEDULED"
                    : form.status
                }
                onChange={(e) => change("status", e.target.value)}
              >
                {(kind === "stores"
                  ? ["ACTIVE", "INACTIVE"]
                  : ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]
                ).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
        <div className="flex gap-2">
          <button disabled={busy} className={primary} type="submit">
            {busy
              ? "Menyimpan..."
              : "Simpan " +
              (kind === "branches"
                ? "Cabang"
                : kind === "stores"
                  ? "Store"
                  : "Event")}
          </button>
          {id && (
            <button
              disabled={busy}
              type="button"
              className={button}
              onClick={() => reset()}
            >
              Batal edit
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
