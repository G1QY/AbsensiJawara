import { branchLabel } from '../../lib/locationLabel';
import ExportButtons from '../../components/ui/ExportButtons';
import { useState, type FormEvent } from "react"
import { api } from "../../lib/apiClient"
import { type Directory, control, button, primary, message } from "./adminData"
import GoogleLocationPicker from "../../components/maps/GoogleLocationPicker"
type Kind = "branches" | "stores" | "events"
const blank = {
  city_name: "",
  company_name: "",
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
  const [showArchived,setShowArchived]=useState(false)
  const [officeTab, setOfficeTab] = useState(false)
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
          ? { code: form.code, name: form.name, company_name: form.company_name, city_name: form.city_name }
          : kind === "stores"
            ? {
              ...form,
              location_kind: officeTab ? "OFFICE" : "STORE",
              latitude: Number(form.latitude),
              longitude: Number(form.longitude),
              radius_meters: Number(form.radius_meters),
            }
            : {
              branch_id: form.branch_id,
              event_code: form.code,
              company_name: form.company_name,
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
    if (!window.confirm(`Hapus ${kind === "branches" ? "cabang" : "store"} "${name}"? Lokasi dengan riwayat akan diarsipkan. Penugasan aktif perlu diakhiri terlebih dahulu.`)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result=await api.delete<{message:string}>(`/admin-directory/${kind}/${rowId}`);
      if (id === rowId) reset();
      setSuccess(result.message);
      await onSaved();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  const rows = kind === "stores" ? (showArchived ? data.archivedStores || [] : data.stores).filter(row => (row.location_kind === "OFFICE") === officeTab) : data[kind]
  return (
    <div className="space-y-4">
      <ExportButtons filename="Direktori-Lokasi" title={kind==='branches'?'Daftar Cabang':kind==='events'?'Daftar Event':officeTab?'Daftar Kantor':'Daftar Store'} subtitle="Data lokasi saat ini" headers={['Nama','Perusahaan','Kota','Cabang','Alamat','Status']} rows={rows.map(row=>['event_name' in row?row.event_name:row.name,row.company_name||'Belum diisi',('branch_id' in row?data.branches.find(b=>b.id===row.branch_id)?.city_name:row.city_name)||'Belum diisi','branch_id' in row?data.branches.find(b=>b.id===row.branch_id)?.name||'Belum ditetapkan':row.name,'address' in row?row.address:'','status' in row?row.status:''].map(value => String(value ?? '')))} />
      {!eventsOnly && (
        <div className="flex flex-wrap gap-2">
          {(["branches", "stores"] as Kind[]).map((k) => (
            <button
              key={k}
              disabled={busy}
              className={kind === k && !officeTab ? primary : button}
              onClick={() => { setShowArchived(false); setOfficeTab(false); reset(k); }}
            >
              {k === "branches" ? "Cabang" : "Store"}
            </button>
          ))}
          <button type="button" disabled={busy} className={officeTab ? primary : button}
            onClick={() => { setShowArchived(false); setOfficeTab(true); reset("stores"); }}>Kantor</button>
        </div>
      )}
      {showArchived && error && <p role="alert" className="text-red-700">{error}</p>}
      {showArchived && success && <p role="status" className="text-emerald-700">{success}</p>}
      <p className="text-sm text-slate-600">
        {kind === "branches"
          ? "Isi kota dan nama tempat cabang. Contoh: Kota Jakarta, Cabang Blok M. Store Roll Film dan Peeps dapat memakai cabang yang sama."
          : kind === "stores"
            ? (officeTab ? "Kelola alamat kantor per cabang. Lokasi aktif akan tersedia pada absensi guest jenis Kantor." : "Pilih lokasi store melalui pencarian alamat atau peta.")
            : "Daftar ini memakai event dari server. Penugasan Crew Event dan posisi dilakukan melalui Detail Event → Crew."}
      </p>
      {kind==='stores' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showArchived} onChange={e=>{setShowArchived(e.target.checked);reset()}}/>Tampilkan lokasi arsip</label>}
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
              <p className="text-xs text-slate-500">{row.company_name || "Perusahaan belum ditetapkan"}</p>
              <p className="text-xs text-slate-500">
                {"branch_id" in row
                  ? branchLabel(data.branches.find((b) => b.id === row.branch_id)) ||
                  "Cabang belum ditetapkan"
                  : row.city_name || "Kota belum diisi"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                disabled={busy || showArchived}
                className={button}
                onClick={() => {
                  setShowArchived(false)
                  setId(row.id)
                  setError("")
                  setSuccess("")
                  setForm({
                    ...blank,
                    ...row,
                    city_name: "city_name" in row ? row.city_name || "" : "",
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
              {kind !== "events" && !showArchived && <button type="button" disabled={busy} className={button + " text-red-700"}
                onClick={() => remove(row.id, "event_name" in row ? row.event_name : row.name)}>Hapus</button>}
              {kind==='stores' && showArchived && <button type="button" className={button} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const result=await api.post<{message:string}>(`/admin-directory/stores/${row.id}/restore`);setSuccess(result.message);await onSaved()}catch(e){setError(message(e))}finally{setBusy(false)}}}>Pulihkan</button>}
            </div>
          </div>
        ))}
        {!rows.length && (
          <p className="p-4 text-sm text-slate-500">
            Belum ada data. Tambahkan melalui form di bawah.
          </p>
        )}
      </div>
      {!showArchived && <form onSubmit={save} className="space-y-4">
        <h3 className="font-semibold text-slate-900">
          {id ? "Edit" : "Tambah"}{" "}
          {kind === "branches"
            ? "Cabang"
            : kind === "stores"
              ? (officeTab ? "Kantor" : "Store")
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
          {kind==='branches' && <label className="text-sm text-slate-700">Kota<input required maxLength={150} list="directory-cities" className={control} value={form.city_name} onChange={e=>change('city_name',e.target.value)} placeholder="Contoh: Jakarta"/><datalist id="directory-cities">{[...new Set(data.branches.map(b=>b.city_name).filter(Boolean))].map(city=><option key={city} value={city}/>)}</datalist></label>}
          <label className="text-sm text-slate-700">Perusahaan
            <input maxLength={150} className={control} value={form.company_name} onChange={e=>change("company_name",e.target.value)} placeholder="Nama perusahaan pemilik lokasi" />
          </label>
          <label className="text-sm text-slate-700">
            Nama{" "}
            {kind === "branches"
              ? "Cabang"
              : kind === "stores"
                ? (officeTab ? "Kantor" : "Store")
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
              Cabang / Tempat
              <select
                aria-label="Cabang / Tempat"
                required
                className={control}
                value={form.branch_id}
                onChange={(e) => change("branch_id", e.target.value)}
              >
                <option value="">Pilih cabang</option>
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {kind === "stores" && (
            <>
              <div className="sm:col-span-2">
                <GoogleLocationPicker
                  title={officeTab ? "Lokasi Kantor" : "Lokasi Store"}
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
                  ? (officeTab ? "Kantor" : "Store")
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
      </form>}
    </div>
  )
}
