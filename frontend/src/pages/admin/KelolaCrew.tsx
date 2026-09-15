import { branchLabel } from '../../lib/locationLabel';
import ExportButtons from '../../components/ui/ExportButtons';
import CrewCsvImport from "./CrewCsvImport"
import { useState, useEffect, type FormEvent } from "react"
import { StatusBadge } from "../../components/ui/Badge"
import Modal from "../../components/ui/Modal"
import Avatar from "../../components/ui/Avatar"
import { api } from "../../lib/apiClient"
import DirectoryManager from "./DirectoryManager"
import StoreScheduleManager from "./StoreScheduleManager"
import BulkStoreScheduleManager from "./BulkStoreScheduleManager"
import {
  type Crew,
  type Directory,
  money,
  crewKind,
  eventCount,
  sources,
  control,
  button,
  primary,
  panel,
  message,
} from "./adminData"
const empty = {
  fullName: "",
  email: "",
  password: "",
  phoneNumber: "",
  companyName: "",
  jobTitle: "",
  crewType: "CREW_EVENT",
  baseSalary: "0",
  status: "ACTIVE",
  branchId: "",
  assignTo: "",
}
export default function KelolaCrew() {
  const [crew, setCrew] = useState<Crew[]>([])
  const [directory, setDirectory] = useState<Directory>({
    branches: [],
    stores: [],
    events: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [search, setSearch] = useState("")
  const [kind, setKind] = useState("")
  const [status, setStatus] = useState("")
  const [branch, setBranch] = useState("")
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<Crew | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showDirectory, setShowDirectory] = useState(false)
  const [detail, setDetail] = useState<Crew | null>(null)
  const [scheduleCrew, setScheduleCrew] = useState<Crew | null>(null)
  const [showBulkSchedule, setShowBulkSchedule] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState("")
  const [action, setAction] = useState<"status" | "delete" | "password" | null>(
    null,
  )
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [emailNotice, setEmailNotice] = useState('')
  async function saveEmail() {
    if(!editing)return
    if(!window.confirm(`Ubah email login ${editing.user.email} menjadi ${form.email}? Pastikan alamat milik crew ini.`))return
    setBusy(true);setFormError('');setEmailNotice('')
    try {
      const data=await api.patch<{email:string}>(`/crew/${editing.id}/email`,{email:form.email,expectedEmail:editing.user.email})
      setEditing({...editing,user:{...editing.user,email:data.email}})
      setForm(f=>({...f,email:data.email}));setEmailNotice('Email login sudah tersimpan. Perubahan profil lain tetap perlu Simpan Crew.')
      await reload()
    }catch(e){setFormError(message(e))}finally{setBusy(false)}
  }
  async function loadDirectory() {
    setDirectory(await api.get<Directory>("/admin-directory"))
  }
  async function reload() {
    setCrew(await api.get<Crew[]>("/crew"))
  }
  async function load() {
    setLoading(true)
    setError("")
    try {
      await Promise.all([reload(), loadDirectory()])
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  function openForm(c?: Crew) {
    setEmailNotice('')
    setEditing(c || null)
    setFormError("")
    setVisible(false)
    setDetail(null)
    const activeStore=c?.crew_type==="CREW_STORE"?(c.store_assignments||[]).find(a=>a.status==="ACTIVE")?.store?.id||"":""
    setForm(
      c
        ? {
            fullName: c.user.full_name,
            email: c.user.email,
            password: "",
            phoneNumber: c.user.phone_number || "",
            companyName: c.company_name || "",
            jobTitle: c.job_title || "",
            crewType: c.crew_type,
            baseSalary: String(Number(c.base_salary)),
            status: c.status,
            branchId: c.branch_id || "",
            assignTo: activeStore,
          }
        : { ...empty },
    )
    setShowForm(true)
  }
  function change(key: keyof typeof empty, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function changeCodeInputs(patch: Partial<typeof empty>) {
    setForm(previous => ({...previous, ...patch}))
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFormError("")
    try {
      const { email, password, baseSalary, ...rest } = form
      if (editing && email !== editing.user.email)
        throw new Error("Klik Perbarui email login terlebih dahulu, atau kembalikan email sebelum menyimpan profil.")
      if (!/^\d*$/.test(baseSalary))
        throw new Error("Gaji pokok harus angka rupiah bulat.")
      const body = {
        ...rest,
        baseSalary: Number(baseSalary || 0),
        branchId: form.branchId || null,
        assignTo: form.crewType === "CREW_STORE" ? form.assignTo || null : null,
        ...(!editing ? { email, password } : {}),
      }
      if (editing) await api.patch(`/crew/${editing.id}`, body)
      else await api.post("/crew", body)
      setShowForm(false)
      setForm({ ...empty })
      setNotice(
        editing
          ? "Perubahan crew tersimpan."
          : "Akun crew berhasil dibuat. Email dan password awal dapat dipakai untuk login.",
      )
      try {
        await reload()
      } catch (e) {
        setError(
          "Perubahan tersimpan, tetapi daftar belum termuat: " + message(e),
        )
      }
    } catch (e) {
      setFormError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function openDetail(c: Crew) {
    setBusy(true)
    setError("")
    setAction(null)
    setFormError("")
    setPassword("")
    try {
      setDetail(await api.get<Crew>(`/crew/${c.id}`))
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function confirmAction(e: FormEvent) {
    e.preventDefault()
    if (!detail || !action) return
    setBusy(true)
    setFormError("")
    try {
      if (action === "password") {
        await api.patch(`/crew/${detail.id}/reset-password`, {
          newPassword: password,
        })
        setPassword("")
        setAction(null)
        setNotice(
          "Password baru tersimpan. Sampaikan kepada pemilik akun melalui jalur pribadi.",
        )
      } else {
        if (action === "delete") await api.delete(`/crew/${detail.id}`)
        else
          await api.patch(`/crew/${detail.id}`, {
            status: detail.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
          })
        setNotice(
          action === "delete"
            ? "Crew diarsipkan. Riwayat absensi tetap tersimpan."
            : "Status dan akses akun crew telah diperbarui.",
        )
        setDetail(null)
        setAction(null)
        try {
          await reload()
        } catch (e) {
          setError(
            "Perubahan tersimpan, tetapi daftar belum termuat: " + message(e),
          )
        }
      }
    } catch (e) {
      setFormError(message(e))
    } finally {
      setBusy(false)
    }
  }
  const filtered = crew.filter(
    (c) =>
      (!kind || c.crew_type === kind) &&
      (!status || c.status === status) &&
      (!branch || c.branch_id === branch) &&
      [
        c.user.full_name,
        c.user.email,
        c.company_name,
        c.job_title,
        c.user.phone_number,
        branchLabel(c.branch),
        ...sources(c),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const locations = form.crewType === "CREW_STORE"
    ? directory.stores.filter((s) => s.branch_id === form.branchId && s.status === "ACTIVE").map((s) => ({ id: s.id, name: s.name, code:s.code }))
    : directory.events.filter((e) => e.branch_id === form.branchId && ["SCHEDULED","ONGOING"].includes(e.status)).map((e) => ({ id:e.id, name:e.event_name, code:e.event_code }))
  return (
    <div className="p-4 sm:p-6 space-y-5">
      {notice && (
        <div
          role="status"
          className="flex justify-between gap-3 bg-emerald-50 text-emerald-700 rounded-xl p-3 text-sm"
        >
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Tutup pemberitahuan"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-700 rounded-xl p-4 text-sm"
        >
          {error}
          <button onClick={() => void load()} className={button + " ml-3"}>
            Coba lagi
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          aria-label="Cari crew"
          placeholder="Cari nama, perusahaan, jabatan, atau lokasi..."
          className={control + " flex-1 min-w-52"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          disabled={loading || busy || !!error}
          className={button}
          onClick={() => setShowDirectory(true)}
        >
          Cabang, Store &amp; Kantor
        </button>
        <button
          disabled={loading || busy || !!error}
          className={button}
          onClick={() => setShowBulkSchedule(true)}
        >
          Jadwal Massal
        </button>
        <button disabled={loading || busy || !!error} className={button} onClick={()=>setShowImport(true)}>Impor CSV</button>
        <button
          disabled={loading || busy || !!error}
          className={primary}
          onClick={() => openForm()}
        >
          + Tambah Crew
        </button>
      </div>
      {!loading && !error && <ExportButtons filename="Daftar-Crew" title="Daftar Crew" subtitle="Mengikuti pencarian dan filter Kelola Crew" headers={['Nama','HP','Email','Perusahaan','Jabatan','Cabang','Penempatan','Jenis Penugasan','Status']} rows={filtered.map(c=>[c.user.full_name,c.user.phone_number||'',c.user.email,c.company_name||'Belum diisi',c.job_title||'Belum diisi',branchLabel(c.branch)||'Belum ditetapkan',sources(c).join(', ')||'Belum ditugaskan',crewKind(c),c.status==='ACTIVE'?'Aktif':'Non-Aktif'])} />}
      {showImport && <CrewCsvImport onClose={()=>setShowImport(false)} onSaved={reload} existingEmails={crew.map(c=>c.user.email)} />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          aria-label="Filter jenis"
          className={control}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Semua jenis crew</option>
          <option value="CREW_STORE">Crew Store</option>
          <option value="CREW_EVENT">Crew Event</option>
        </select>
        <select
          aria-label="Filter cabang"
          className={control}
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        >
          <option value="">Semua cabang</option>
          {directory.branches.map((b) => (
            <option key={b.id} value={b.id}>
              {branchLabel(b)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          className={control}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Semua status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Non-Aktif</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["Total Crew", crew.length],
          [
            "Crew Event",
            crew.filter((c) => c.crew_type === "CREW_EVENT").length,
          ],
          [
            "Crew Store",
            crew.filter((c) => c.crew_type === "CREW_STORE").length,
          ],
          ["Non-Aktif", crew.filter((c) => c.status === "INACTIVE").length],
        ].map(([label, n]) => (
          <span
            key={label}
            className="rounded-lg px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold"
          >
            {label}: {loading ? "..." : n}
          </span>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                {[
                  "Nama & Kontak", "Perusahaan", "Jabatan", "Cabang",
                  "Penempatan", "Jenis Penugasan", "Status", "Aksi",
                ].map((h) => (
                  <th
                    key={h}
                    className={
                      "p-4 text-left whitespace-nowrap" +
                      (h === "Aksi" ? " sticky right-0 bg-slate-50 z-10" : "")
                    }
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-4 min-w-56">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.user.full_name} />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {c.user.full_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.user.phone_number || "HP belum diisi"}
                        </p>
                        <p className="text-xs text-slate-500 break-all">{c.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-700">{c.company_name || "Belum ditetapkan"}</td>
                  <td className="p-4 text-slate-700">{c.job_title || "Belum ditetapkan"}</td>
                  <td className="p-4 text-slate-700">{branchLabel(c.branch) || "Belum ditetapkan"}</td>
                  <td className="p-4 min-w-40 text-slate-700">{sources(c).join(", ") || "Belum ditugaskan"}</td>
                  <td className="p-4 whitespace-nowrap text-blue-700">
                    {crewKind(c)}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <StatusBadge
                      status={c.status === "ACTIVE" ? "Aktif" : "Non-Aktif"}
                    />
                  </td>
                  <td className="p-4 sticky right-0 bg-white z-10">
                    <button
                      disabled={busy}
                      onClick={() => void openDetail(c)}
                      className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <p className="p-10 text-center text-sm text-slate-500">
            {loading
              ? "Memuat crew dari server..."
              : error
                ? "Data belum dapat dimuat."
                : "Tidak ada crew ditemukan."}
          </p>
        )}
        <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
          Menampilkan {filtered.length} dari {crew.length} crew.
        </p>
      </div>
      <Modal
        open={showForm}
        onClose={() => {
          if (!busy) {
            setShowForm(false)
            setForm({ ...empty })
          }
        }}
        title={editing ? "Edit Crew" : "Tambah Crew Baru"}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <p
              role="alert"
              className="text-red-700 bg-red-50 p-3 rounded-xl text-sm"
            >
              {formError}
            </p>
          )}
          <fieldset
            disabled={busy}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label className="text-sm text-slate-700">
              Nama Lengkap
              <input
                required
                minLength={2}
                maxLength={150}
                className={control}
                value={form.fullName}
                onChange={(e) => change("fullName", e.target.value)}
              />
            </label>
            <div className="text-sm text-slate-700">
              <label htmlFor="crew-login-email">Email</label>
              <input
                id="crew-login-email"
                required
                type="email"
                maxLength={150}
                className={control}
                value={form.email}
                onChange={(e) => change("email", e.target.value)}
              />
              {editing&&<button type="button" disabled={busy||form.email===editing.user.email} className={button+' mt-2'} onClick={()=>void saveEmail()}>Perbarui email login</button>}
            </div>
            {!editing && (
              <div className="text-sm text-slate-700">
                <label htmlFor="crew-initial-password">Password Awal</label>
                <div className="flex gap-2">
                  <input
                    id="crew-initial-password"
                    required
                    autoComplete="new-password"
                    type={visible ? "text" : "password"}
                    minLength={8}
                    maxLength={128}
                    className={control}
                    value={form.password}
                    onChange={(e) => change("password", e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={
                      visible ? "Sembunyikan password" : "Tampilkan password"
                    }
                    className={button}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Sembunyikan" : "Lihat"}
                  </button>
                </div>
              </div>
            )}
            <label className="text-sm text-slate-700">
              Nomor HP
              <input
                type="tel"
                maxLength={30}
                className={control}
                value={form.phoneNumber}
                onChange={(e) => change("phoneNumber", e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-700">Perusahaan
              <input list="crew-companies" maxLength={150} className={control} value={form.companyName} onChange={e=>change("companyName",e.target.value)} placeholder="Pilih atau ketik perusahaan" />
              <datalist id="crew-companies">{[...new Set(["Fotosnaps", "Jawara Group", "Kripik Bujangan", ...crew.map(c=>c.company_name).filter(Boolean)])].map(name=><option key={name} value={name} />)}</datalist>
            </label>
            <label className="text-sm text-slate-700">Jabatan
              <input maxLength={100} className={control} value={form.jobTitle} onChange={e=>change("jobTitle",e.target.value)} placeholder="Contoh: Supervisor, Kasir, Fotografer" />
              <span className="text-xs text-slate-500">Jabatan tidak mengubah hak akses akun.</span>
            </label>
            <label className="text-sm text-slate-700">
              Jenis Penugasan
              <select
                aria-label="Jenis Crew"
                className={control}
                value={form.crewType}
                onChange={(e) =>
                  changeCodeInputs({ crewType: e.target.value, assignTo: "" })
                }
              >
                <option value="CREW_EVENT">Crew Event</option>
                <option value="CREW_STORE">Crew Store</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Gaji Pokok (Rp)
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={control}
                value={form.baseSalary}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value))
                    change(
                      "baseSalary",
                      e.target.value.replace(/^0+(?=\d)/, ""),
                    )
                }}
                onBlur={() => {
                  if (!form.baseSalary) change("baseSalary", "0")
                }}
              />
            </label>
            <label className="text-sm text-slate-700">
              Status Akun
              <select
                aria-label="Status Akun"
                className={control}
                value={form.status}
                onChange={(e) => change("status", e.target.value)}
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Non-Aktif</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Kantor Cabang
              <select
                aria-label="Kantor Cabang"
                className={control}
                value={form.branchId}
                onChange={(e) =>
                  changeCodeInputs({ branchId: e.target.value, assignTo: "" })
                }
              >
                <option value="">Belum ditetapkan</option>
                {directory.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            {form.crewType === "CREW_STORE" ? <label className="text-sm text-slate-700">Store / Kantor Penugasan
              <select aria-label="Store / Kantor Penugasan" disabled={!form.branchId} className={control} value={form.assignTo} onChange={e=>change("assignTo",e.target.value)}>
                <option value="">Belum ditugaskan</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label> : <p className="text-sm text-slate-500">Penugasan event diatur melalui Kelola Event setelah akun dibuat.</p>}
          </fieldset>
          {editing && (
            <p className="text-xs text-slate-500">
              Setelah mengubah email, klik Perbarui email login. Mengganti
              jenis crew mengakhiri penugasan aktif lama. Store baru
              menggantikan store aktif. Penugasan Crew Event dan posisi hanya
              diatur melalui Kelola Event. Jadwal absensi tidak dibuat otomatis.
            </p>
          )}
          {emailNotice&&<p role="status" className="text-sm text-emerald-700">{emailNotice}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              className={button}
              onClick={() => {
                setShowForm(false)
                setForm({ ...empty })
              }}
            >
              Batal
            </button>
            <button disabled={busy} type="submit" className={primary}>
              {busy ? "Menyimpan..." : "Simpan Crew"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!detail}
        onClose={() => {
          if (!busy) {
            setDetail(null)
            setPassword("")
            setAction(null)
          }
        }}
        title={"Detail Crew" + (detail ? " • " + detail.user.full_name : "")}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                name={detail.user.full_name}
                src={detail.avatarUrl}
                large
              />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  {detail.user.full_name}
                </h3>
                <p className="text-sm text-slate-500 break-all">
                  {detail.user.email}
                </p>
                <p className="text-xs text-slate-500">{detail.company_name || "Perusahaan belum ditetapkan"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Jenis", crewKind(detail)],
                ["Status", detail.status === "ACTIVE" ? "Aktif" : "Non-Aktif"],
                ["Nomor HP", detail.user.phone_number || "Belum diisi"],
                ["Perusahaan", detail.company_name || "Belum ditetapkan"],
                ["Jabatan", detail.job_title || "Belum ditetapkan"],
                ["Cabang", branchLabel(detail.branch) || "Belum ditetapkan"],
                ["Gaji Pokok", money(detail.base_salary)],
                ["Jumlah Event", eventCount(detail)],
              ].map(([label, value]) => (
                <div className="bg-slate-50 p-3 rounded-xl" key={label}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="font-semibold text-sm text-slate-900 break-words">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Store / Event Aktif
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                {sources(detail).join(", ") || "Belum ditugaskan"}
              </p>
            </div>
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer">Riwayat penugasan</summary>
              <ul className="mt-2 space-y-2">
                {(detail.store_assignments || []).map((a) => (
                  <li key={a.id}>
                    {a.store?.name || "Store"} • {a.status} • {a.start_date}
                  </li>
                ))}
                {(detail.event_assignments || []).map((a) => (
                  <li key={a.id}>
                    {a.event?.event_name || "Event"} • {a.event?.event_date} •{" "}
                    {a.position || "Posisi belum diisi"} • {a.status}
                  </li>
                ))}
              </ul>
              {!(
                detail.store_assignments?.length ||
                detail.event_assignments?.length
              ) && <p>Belum ada riwayat.</p>}
            </details>
            {!action ? (
              <div className="flex flex-wrap gap-2 justify-end">
                {detail.crew_type === "CREW_STORE" && (
                  <button
                    disabled={busy}
                    className={primary}
                    onClick={() => { setScheduleCrew(detail); setDetail(null) }}
                  >
                    Atur Jadwal Store
                  </button>
                )}
                <button
                  disabled={busy}
                  className={button}
                  onClick={() => openForm(detail)}
                >
                  Edit
                </button>
                <button
                  className={button}
                  onClick={() => {
                    setAction("password")
                    setVisible(false)
                    setFormError("")
                  }}
                >
                  Atur Password
                </button>
                <button
                  className={button.replace("text-slate-700", "text-amber-700")}
                  onClick={() => {
                    setAction("status")
                    setFormError("")
                  }}
                >
                  {detail.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  className={button.replace("text-slate-700", "text-red-700")}
                  onClick={() => {
                    setAction("delete")
                    setFormError("")
                  }}
                >
                  Hapus
                </button>
              </div>
            ) : (
              <form onSubmit={confirmAction} className={panel + " space-y-3"}>
                <p className="text-sm text-slate-700">
                  {action === "delete"
                    ? "Hapus dari daftar dan tutup akses login crew ini? Data akan diarsipkan, bukan dihapus permanen. Riwayat absensi tetap tersedia."
                    : action === "status"
                      ? `Konfirmasi ${
                          detail.status === "ACTIVE"
                            ? "menonaktifkan akses login"
                            : "mengaktifkan kembali akun"
                        } ${detail.user.full_name}?`
                      : "Password lama tidak dapat ditampilkan. Isi password baru untuk akun ini."}
                </p>
                {action === "password" && (
                  <label className="block text-sm text-slate-700">
                    Password Baru
                    <input
                      required
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      type="password"
                      className={control}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                )}
                {formError && (
                  <p role="alert" className="text-sm text-red-700">
                    {formError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className={button}
                    onClick={() => {
                      setAction(null)
                      setPassword("")
                    }}
                  >
                    Batal
                  </button>
                  <button disabled={busy} className={primary} type="submit">
                    {busy ? "Menyimpan..." : "Konfirmasi"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={!!scheduleCrew}
        onClose={() => setScheduleCrew(null)}
        title={"Jadwal Crew Store" + (scheduleCrew ? " • " + scheduleCrew.user.full_name : "")}
        size="lg"
      >
        {scheduleCrew && <StoreScheduleManager crewId={scheduleCrew.id} crewName={scheduleCrew.user.full_name} />}
      </Modal>
      <Modal
        open={showDirectory}
        onClose={() => setShowDirectory(false)}
        title="Kelola Cabang, Store & Kantor"
        size="lg"
      >
        <DirectoryManager data={directory} onSaved={loadDirectory} />
      </Modal>
      <Modal
        open={showBulkSchedule}
        onClose={() => setShowBulkSchedule(false)}
        title="Jadwal Massal Crew Store"
        size="lg"
      >
        <BulkStoreScheduleManager stores={directory.stores} />
      </Modal>
    </div>
  )
}
