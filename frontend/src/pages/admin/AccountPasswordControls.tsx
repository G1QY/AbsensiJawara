import { useEffect, useRef, useState } from "react"
import { api } from "../../lib/apiClient"
import { useAuth } from "../../lib/AuthContext"
import { button, control, primary, message } from "./adminData"

export default function AccountPasswordControls({
  crewId,
}: {
  crewId: string
}) {
  const { auth } = useAuth()
  const [password, setPassword] = useState(""),
    [nextPassword, setNextPassword] = useState("")
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("")
  const generation = useRef(0)
  useEffect(() => {
    const hide = () => {
      generation.current++
      setPassword("")
    }
    const visibility = () => {
      if (document.hidden) hide()
    }
    window.addEventListener("blur", hide)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      generation.current++
      window.removeEventListener("blur", hide)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [])
  useEffect(() => {
    if (!password) return
    const timer = setTimeout(() => setPassword(""), 30000)
    return () => clearTimeout(timer)
  }, [password])
  if (auth?.role !== "SUPER_ADMIN") return null
  async function reveal() {
    if (password) {
      generation.current++
      setPassword("")
      return
    }
    const request = ++generation.current
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await api.post<{
        available: boolean
        password?: string
        message?: string
      }>(`/crew/${crewId}/reveal-password`)
      if (request === generation.current) {
        setPassword(result.available ? result.password || "" : "")
        setNotice(result.message || "")
      }
    } catch (e) {
      if (request === generation.current) setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function reset() {
    generation.current++
    setPassword("")
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const result = await api.patch<{ passwordNotice?: string }>(
        `/crew/${crewId}/reset-password`,
        { newPassword: nextPassword },
      )
      setNextPassword("")
      setEditing(false)
      setNotice(
        result.passwordNotice ||
          "Password baru tersimpan. Klik Tampilkan password untuk melihatnya.",
      )
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-4">
      <label className="block text-sm">
        Password akun
        <input
          aria-label="Password akun"
          autoComplete="off"
          readOnly
          className={control + " mt-1"}
          value={password || "••••••••"}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={busy}
          onClick={() => void reveal()}
        >
          {password ? "Sembunyikan password" : "Tampilkan password"}
        </button>
        <button
          className={button}
          disabled={busy}
          onClick={() => {
            generation.current++
            setPassword("")
            setNextPassword("")
            setEditing(!editing)
            setError("")
          }}
        >
          {editing ? "Batal atur password" : "Atur Password"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Hanya Super Admin. Password tersembunyi kembali setelah 30 detik atau
        saat meninggalkan jendela.
      </p>
      {editing && (
        <form
          className="rounded-xl border border-slate-200 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void reset()
          }}
        >
          <p className="text-sm text-slate-600">
            Password baru langsung menggantikan password login sebelumnya.
          </p>
          <label className="block text-sm">
            Password baru
            <input
              className={control + " mt-1"}
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              disabled={busy}
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
            />
          </label>
          <button className={primary} disabled={busy}>
            {busy ? "Menyimpan..." : "Simpan password baru"}
          </button>
        </form>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800"
        >
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="ui-error rounded-xl p-3 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}
