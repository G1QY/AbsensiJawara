import { useEffect, useState } from "react"
import { useAuth } from "../../lib/AuthContext"
import { api } from "../../lib/apiClient"
import { t } from "../../lib/i18n"
import Modal from "../../components/ui/Modal"
import ExportButtons from "../../components/ui/ExportButtons"
import { button, control, primary, message, type Directory } from "./adminData"
interface Account {
  id: string
  full_name: string
  email: string
  is_active: boolean
  user_roles: { role: { code: string; name: string } }[]
  head_store_scopes: { city_name: string }[]
  crew: {
    id: string
    crew_type: string
    status: string
    deleted_at: string | null
  }[]
}
const roles: Record<string, string> = {
  CREW_STORE: "Crew Store",
  CREW_EVENT: "Crew Event",
  HEAD_STORE: "Head Store",
  EVENT_MANAGER: "Event Manager",
  SUPER_ADMIN: "Super Admin",
}
const roleOf = (a: Account) =>
  a.user_roles.map((r) => roles[r.role.code] || r.role.name).join(", ") ||
  "Belum ditetapkan"
export default function AccountsWorkspace() {
  const { auth } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([]),
    [directory, setDirectory] = useState<Directory>({
      branches: [],
      stores: [],
      events: [],
    })
  const [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Account | null>(null),
    [role, setRole] = useState("CREW_STORE"),
    [branchId, setBranchId] = useState(""),
    [deleting, setDeleting] = useState<Account | null>(null),
    [confirmEmail, setConfirmEmail] = useState(""),
    [modalError, setModalError] = useState("")
  async function load() {
    setLoading(true)
    setError("")
    try {
      const [a, d] = await Promise.all([
        api.get<Account[]>("/accounts"),
        api.get<Directory>("/admin-directory"),
      ])
      setAccounts(a)
      setDirectory(d)
    } catch (e) {
      setError(message(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  if (auth?.role !== "SUPER_ADMIN")
    return (
      <p className="p-6" role="alert">
        {t("Hanya Super Admin dapat mengubah role.")}
      </p>
    )
  const cities = [
    ...new Map(
      directory.branches
        .filter((b) => b.city_name?.trim())
        .map((b) => [b.city_name!.trim().toLowerCase(), b]),
    ).values(),
  ].sort((a, b) => a.city_name!.localeCompare(b.city_name!))
  const filtered = accounts.filter((a) =>
    [a.full_name, a.email, roleOf(a), a.head_store_scopes?.[0]?.city_name]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  async function save() {
    if (!selected) return
    setBusy(true)
    setModalError("")
    try {
      await api.patch(`/accounts/${selected.id}/role`, { role, branchId })
      setSelected(null)
      setNotice(
        "Role tersimpan. Pengguna perlu masuk kembali untuk memperbarui menu.",
      )
      await load()
    } catch (e) {
      setModalError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deleting?.crew[0]) return
    setBusy(true)
    setModalError("")
    try {
      await api.delete(`/crew/${deleting.crew[0].id}`, {
        confirm: true,
        email: confirmEmail,
      })
      setDeleting(null)
      setNotice(
        "Crew dan akun login dihapus permanen. Email dapat digunakan kembali.",
      )
      await load()
    } catch (e) {
      setModalError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("Akun & Hak Akses")}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {t(
              "Akun baru mengikuti jenis Crew Store atau Crew Event. Atur promosi dan kota cakupan di sini.",
            )}
          </p>
        </div>
        <button
          className={button}
          disabled={loading}
          onClick={() => void load()}
        >
          {t("Muat ulang")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {t(error)}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-700">
          {t(notice)}
        </p>
      )}
      <input
        className={control}
        aria-label={t("Cari akun")}
        placeholder={t("Cari nama, email, role atau kota")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ExportButtons
        filename="Akun_Jawara"
        title="Akun & Hak Akses"
        subtitle="JAWARA"
        headers={["Nama", "Email", "Role", "Kota", "Status"]}
        rows={filtered.map((a) => [
          a.full_name,
          a.email,
          roleOf(a),
          a.head_store_scopes?.[0]?.city_name || "",
          a.is_active ? "Aktif" : "Nonaktif",
        ])}
      />
      {loading ? (
        <p>{t("Memuat data...")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Nama", "Role", "Kota cakupan", "Status", "Aksi"].map((h) => (
                  <th className="text-left p-4" key={h}>
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="p-4">
                    <strong>{a.full_name}</strong>
                    <p className="text-xs text-slate-500 break-all">
                      {a.email}
                    </p>
                  </td>
                  <td className="p-4">{roleOf(a)}</td>
                  <td className="p-4">
                    {a.head_store_scopes?.[0]?.city_name || "—"}
                  </td>
                  <td className="p-4">
                    {t(
                      a.crew[0]?.deleted_at
                        ? "Diarsipkan"
                        : a.is_active
                          ? "Aktif"
                          : "Nonaktif",
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={button}
                        disabled={
                          a.id === auth.user.id ||
                          !a.is_active ||
                          !!a.crew[0]?.deleted_at
                        }
                        onClick={() => {
                          setSelected(a)
                          setRole(
                            a.user_roles[0]?.role.code ||
                              a.crew[0]?.crew_type ||
                              "CREW_STORE",
                          )
                          setBranchId(
                            cities.find(
                              (b) =>
                                b.city_name?.toLowerCase() ===
                                a.head_store_scopes?.[0]?.city_name.toLowerCase(),
                            )?.id || "",
                          )
                          setModalError("")
                        }}
                      >
                        {t("Ubah role")}
                      </button>
                      {a.crew[0] &&
                        a.id !== auth.user.id &&
                        !a.user_roles.some(
                          (r) => r.role.code === "SUPER_ADMIN",
                        ) && (
                          <button
                            className={button + " text-red-700"}
                            onClick={() => {
                              setDeleting(a)
                              setConfirmEmail("")
                              setModalError("")
                            }}
                          >
                            {t("Hapus permanen")}
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="p-6">{t("Belum ada data yang sesuai.")}</p>
          )}
        </div>
      )}
      <Modal
        open={!!selected}
        onClose={() => {
          if (!busy) setSelected(null)
        }}
        title="Ubah role"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <p>{selected?.full_name}</p>
          <label className="block text-sm">
            {t("Role akun")}
            <select
              className={control}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {Object.entries(roles).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {role === "HEAD_STORE" && (
            <label className="block text-sm">
              {t("Kota cakupan")}
              <select
                required
                className={control}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">{t("Pilih kota")}</option>
                {cities.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.city_name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                {t(
                  "Head Store memantau seluruh cabang dan store dalam satu kota.",
                )}
              </span>
            </label>
          )}
          <p className="text-sm text-slate-600">
            {t(
              role === "SUPER_ADMIN"
                ? "Super Admin mendapat akses penuh, termasuk role dan penghapusan akun."
                : role.startsWith("CREW_")
                  ? "Mengganti jenis crew mengakhiri penugasan jenis sebelumnya. Atur penugasan baru di Kelola Crew atau Kelola Event."
                  : "Perubahan akses berlaku pada permintaan berikutnya. Masuk kembali untuk memperbarui menu.",
            )}
          </p>
          {modalError && (
            <p role="alert" className="text-red-700">
              {t(modalError)}
            </p>
          )}
          <button className={primary} disabled={busy}>
            {t(busy ? "Menyimpan..." : "Simpan role")}
          </button>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null)
        }}
        title="Hapus akun permanen"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void remove()
          }}
        >
          <p className="text-sm">
            {t(
              "Akun login, profil crew, penugasan, jadwal, absensi, izin, koreksi dan lembur terkait akan dihapus permanen. Event dan store tetap tersedia. Gunakan Nonaktifkan bila riwayat perlu dipertahankan.",
            )}
          </p>
          <p className="font-semibold break-all">{deleting?.email}</p>
          <label className="block text-sm">
            {t("Ketik email akun untuk konfirmasi")}
            <input
              className={control}
              type="email"
              required
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
          </label>
          {modalError && (
            <p role="alert" className="text-red-700">
              {t(modalError)}
            </p>
          )}
          <button
            className="rounded-xl bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            disabled={
              busy ||
              confirmEmail.trim().toLowerCase() !==
                deleting?.email.toLowerCase()
            }
          >
            {t(busy ? "Menghapus…" : "Hapus permanen")}
          </button>
        </form>
      </Modal>
    </div>
  )
}
