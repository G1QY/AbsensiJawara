import { useState } from "react"
import { api } from "../../lib/apiClient"
import { button, primary, control, panel, message, money } from "./adminData"
import Modal from "../../components/ui/Modal"
import {
  type PayrollEntry,
  currentMonth,
  usePayroll,
} from "../payroll/payrollApi"
import {
  PayrollTotals,
  PayrollExports,
  PayrollList,
  PayrollDetails,
  PolicyForm,
  AdjustmentForm,
} from "../payroll/PayrollComponents"
export default function PayrollWorkspace() {
  const [month, setMonth] = useState(currentMonth),
    [kind, setKind] = useState("MONTHLY"),
    [placementKind, setPlacementKind] = useState(""),
    [placement, setPlacement] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("")
  const { data, loading, error, reload } = usePayroll(month)
  const [detailKey, setDetailKey] = useState<string | null>(null),
    [policyOpen, setPolicyOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [actionError, setActionError] = useState(""),
    [confirm, setConfirm] = useState(""),
    [reference, setReference] = useState(""),
    [paidDate, setPaidDate] = useState(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
        new Date(),
      ),
    )
  const all = data?.rows || [],
    detail = all.find((r) => r.key === detailKey) || null
  const base = all.filter(
    (r) =>
      r.kind === kind &&
      (!placementKind ||
        (placementKind === "NONE"
          ? !r.placements.length
          : r.placements.some((p) => p.kind === placementKind))),
  )
  const places = [
    ...new Map(
      base.flatMap((r) => r.placements).map((p) => [p.id, p]),
    ).values(),
  ]
  const rows = base.filter(
    (r) =>
      (!placement || r.placements.some((p) => p.id === placement)) &&
      (!status || r.status === status) &&
      [
        r.person.full_name,
        r.person.email,
        r.person.employee_code,
        r.person.company_name,
        r.person.division,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  )
  async function save(action: string, payload: Record<string, unknown>) {
    if (!data || busy) return
    setBusy(true)
    setActionError("")
    setNotice("")
    try {
      await api.post(`/payroll/${action}`, {
        month,
        revision: data.revision,
        ...payload,
      })
      await reload()
      setPolicyOpen(false)
      setConfirm("")
      setReference("")
      setNotice(
        action === "paid"
          ? "Pembayaran berhasil dicatat."
          : "Payroll berhasil disimpan.",
      )
    } catch (e) {
      setActionError(message(e))
    } finally {
      setBusy(false)
    }
  }
  function show(r: PayrollEntry) {
    setDetailKey(r.key)
    setConfirm("")
    setActionError("")
    setReference("")
  }
  const close = () => {
    if (!busy) {
      setDetailKey(null)
      setConfirm("")
      setActionError("")
    }
  }
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Payroll Karyawan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Aturan gaji, penyesuaian, dan pencatatan pembayaran.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className={button}
            disabled={loading || busy}
            onClick={() => void reload()}
          >
            Muat ulang
          </button>
          <button
            className={primary}
            disabled={!data || busy || loading}
            onClick={() => {
              setActionError("")
              setPolicyOpen(true)
            }}
          >
            Atur payroll
          </button>
        </div>
      </header>
      {(error || (!detail && !policyOpen && actionError)) && (
        <p role="alert" className="ui-error p-4 rounded-xl">
          {error || actionError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <section className={panel + " space-y-4"}>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div
            className="flex gap-1 rounded-full bg-slate-100 p-1"
            role="tablist"
            aria-label="Sistem payroll"
          >
            {[
              ["MONTHLY", "Store & Kantor"],
              ["EVENT", "Crew Event"],
            ].map(([value, label]) => (
              <button
                role="tab"
                aria-selected={kind === value}
                key={value}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  kind === value ? "bg-blue-600 text-white" : "text-slate-600"
                }`}
                onClick={() => {
                  setKind(value)
                  setPlacement("")
                  setPlacementKind("")
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="text-sm text-slate-500 flex items-center gap-2">
            Periode
            <input
              aria-label="Periode payroll"
              type="month"
              className={control + " !w-auto"}
              value={month}
              onChange={(e) => {
                if (e.target.value) {
                  setMonth(e.target.value)
                  setDetailKey(null)
                  setNotice("")
                }
              }}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {kind === "MONTHLY" && (
            <select
              aria-label="Jenis penempatan"
              className={control}
              value={placementKind}
              onChange={(e) => {
                setPlacementKind(e.target.value)
                setPlacement("")
              }}
            >
              <option value="">Semua penempatan</option>
              <option value="STORE">Store</option>
              <option value="OFFICE">Kantor</option>
              <option value="NONE">Belum ditempatkan</option>
            </select>
          )}
          <select
            aria-label={kind === "EVENT" ? "Filter event" : "Lokasi penempatan"}
            className={control}
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          >
            <option value="">
              {kind === "EVENT" ? "Semua event" : "Semua lokasi"}
            </option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Status payroll"
            className={control}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua status</option>
            <option value="DRAFT">Draft</option>
            <option value="FINAL">Final</option>
            <option value="PAID">Dibayar</option>
          </select>
          <input
            className={control}
            aria-label="Cari payroll"
            placeholder="Cari nama, kode, atau divisi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>
      {loading ? (
        <p role="status">Memuat payroll...</p>
      ) : (
        data && (
          <>
            {!data.configured && (
              <p className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
                Aturan periode ini belum disimpan. Potongan dan tambahan
                otomatis belum aktif.
              </p>
            )}
            <PayrollTotals rows={rows} />
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <p className="text-sm text-slate-500">
                {kind === "EVENT"
                  ? "Fee dihitung per event. Telat dan lembur tidak menambah atau memotong fee otomatis."
                  : "Gaji bersih mengikuti aturan tersimpan dan absensi yang disetujui."}
              </p>
              <PayrollExports
                rows={rows}
                month={month}
                onError={setActionError}
              />
            </div>
            <PayrollList rows={rows} onDetail={show} />
          </>
        )
      )}
      <Modal
        open={policyOpen && !!data}
        onClose={() => {
          if (!busy) {
            setPolicyOpen(false)
            setActionError("")
          }
        }}
        title={`Atur Payroll · ${month}`}
        size="lg"
      >
        {data && (
          <div className="space-y-4">
            {actionError && (
              <p className="ui-error p-3 rounded-xl" role="alert">
                {actionError}
              </p>
            )}
            <PolicyForm
              key={month + data.revision}
              policy={data.policy}
              busy={busy}
              onSave={(policy) => void save("policy", { policy })}
            />
          </div>
        )}
      </Modal>
      <Modal
        open={!!detail}
        onClose={close}
        title={`Detail Payroll${detail ? " · " + detail.person.full_name : ""}`}
        size="lg"
      >
        {detail && (
          <div className="space-y-5">
            <PayrollDetails row={detail} />
            {actionError && (
              <p role="alert" className="ui-error p-3 rounded-xl">
                {actionError}
              </p>
            )}
            {detail.status === "DRAFT" && (
              <details className={panel}>
                <summary className="font-semibold text-sm cursor-pointer">
                  Atur komponen gaji
                </summary>
                <div className="mt-4">
                  <AdjustmentForm
                    key={detail.key + data?.revision}
                    row={detail}
                    busy={busy}
                    onSave={(adjustment) =>
                      void save("adjustment", {
                        crewId: detail.crewId,
                        scopeKey: detail.scopeKey,
                        adjustment,
                      })
                    }
                  />
                </div>
              </details>
            )}
            {confirm ? (
              <section className="rounded-xl border border-blue-200 p-4 space-y-3">
                <p className="font-semibold text-sm">
                  {confirm === "finalize"
                    ? "Finalkan payroll ini?"
                    : confirm === "paid"
                      ? "Catat pembayaran payroll"
                      : "Buka kembali payroll"}
                </p>
                {confirm === "finalize" ? (
                  <p className="text-sm text-slate-600">
                    Gaji bersih {money(detail.total)} beserta rincian ini akan
                    disimpan sebagai slip final.
                  </p>
                ) : (
                  <>
                    {confirm === "paid" && (
                      <label className="block text-sm">
                        Tanggal pembayaran
                        <input
                          type="date"
                          className={control + " mt-1"}
                          value={paidDate}
                          onChange={(e) => setPaidDate(e.target.value)}
                        />
                      </label>
                    )}
                    <label className="block text-sm">
                      {confirm === "paid"
                        ? "Referensi transfer / bukti pembayaran"
                        : "Alasan membuka kembali"}
                      <input
                        className={control + " mt-1"}
                        maxLength={confirm === "paid" ? 200 : 1000}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    {confirm === "paid" && (
                      <p className="text-xs text-slate-500">
                        Mencatat pembayaran yang sudah kamu lakukan. Tombol ini
                        tidak mengirim uang.
                      </p>
                    )}
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    className={primary}
                    disabled={
                      busy ||
                      (confirm !== "finalize" &&
                        reference.trim().length < (confirm === "paid" ? 3 : 5))
                    }
                    onClick={() =>
                      void save(
                        confirm,
                        confirm === "finalize"
                          ? { crewId: detail.crewId, scopeKey: detail.scopeKey }
                          : {
                              id: detail.slipId,
                              ...(confirm === "paid"
                                ? {
                                    paid_date: paidDate,
                                    payment_reference: reference,
                                  }
                                : { note: reference }),
                            },
                      )
                    }
                  >
                    {busy
                      ? "Menyimpan..."
                      : confirm === "finalize"
                        ? "Konfirmasi finalisasi"
                        : confirm === "paid"
                          ? "Simpan pembayaran"
                          : "Buka kembali"}
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => setConfirm("")}
                  >
                    Batal
                  </button>
                </div>
              </section>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.status === "DRAFT" && (
                  <button
                    className={primary}
                    disabled={busy || !!detail.blockedReason}
                    onClick={() => setConfirm("finalize")}
                  >
                    Finalkan payroll
                  </button>
                )}
                {detail.status === "FINAL" && (
                  <>
                    <button
                      className={primary}
                      disabled={busy}
                      onClick={() => setConfirm("paid")}
                    >
                      Catat pembayaran
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => setConfirm("reopen")}
                    >
                      Buka kembali draft
                    </button>
                  </>
                )}
              </div>
            )}
            <PayrollExports
              rows={[detail]}
              month={month}
              onError={setActionError}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
