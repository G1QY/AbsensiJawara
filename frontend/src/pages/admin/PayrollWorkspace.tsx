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
export default function PayrollWorkspace({
  onAttendance,
}: {
  onAttendance?: () => void
}) {
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
      const notices: Record<string, string> = {
        policy:
          "Aturan periode " + month + " tersimpan. Draft mengikuti aturan ini.",
        adjustment: "Penyesuaian karyawan tersimpan. Status slip tetap Draft.",
        finalize:
          "Slip berhasil difinalkan. Setelah membayar karyawan, pilih Catat pembayaran.",
        paid: "Pembayaran berhasil dicatat. Status slip sekarang Dibayar.",
        reopen:
          "Slip dibuka kembali menjadi Draft. Periksa perhitungan sebelum finalisasi ulang.",
      }
      setNotice(notices[action])
    } catch (e) {
      setActionError(message(e))
    } finally {
      setBusy(false)
    }
  }
  function show(r: PayrollEntry) {
    setDetailKey(r.key)
    setConfirm(r.status === "FINAL" ? "paid" : "")
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
            Dikelola Super Admin. Siapkan draft, finalkan slip, lalu catat
            pembayaran.
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
            Atur aturan periode
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
            <section
              className={panel + " space-y-4"}
              aria-label="Tahapan payroll"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Mulai dari aturan periode</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {data.configured
                      ? "Aturan " +
                        month +
                        " sudah tersimpan. Periksa draft karyawan sebelum finalisasi."
                      : "Aturan " +
                        month +
                        " belum disimpan. Menyimpan penyesuaian karyawan tidak menyimpan aturan periode."}
                  </p>
                </div>
                <button
                  className={data.configured ? button : primary}
                  onClick={() => {
                    setActionError("")
                    setPolicyOpen(true)
                  }}
                >
                  {data.configured
                    ? "Lihat aturan periode"
                    : "Atur periode sekarang"}
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  {
                    key: "DRAFT",
                    title: "1. Periksa Draft",
                    text: "Gaji masih dapat berubah. Periksa absensi, potongan, dan tambahan.",
                  },
                  {
                    key: "FINAL",
                    title: "2. Finalkan Slip",
                    text: "Nominal dikunci setelah kamu menekan Finalkan payroll. Siap dibayarkan.",
                  },
                  {
                    key: "PAID",
                    title: "3. Catat Pembayaran",
                    text: "Setelah transfer atau bayar tunai, isi tanggal dan referensi pembayaran.",
                  },
                ].map((step) => (
                  <button
                    key={step.key}
                    className={`text-left rounded-xl border p-4 ${
                      status === step.key
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                    onClick={() =>
                      setStatus(status === step.key ? "" : step.key)
                    }
                  >
                    <p className="font-semibold text-sm">{step.title}</p>
                    <p className="text-xs text-slate-600 mt-2">{step.text}</p>
                    <p className="text-sm font-semibold mt-3">
                      {
                        base.filter(
                          (r) =>
                            r.status === step.key &&
                            (!placement ||
                              r.placements.some((p) => p.id === placement)) &&
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
                        ).length
                      }{" "}
                      slip
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                {kind === "MONTHLY"
                  ? "Payroll bulanan dapat difinalkan setelah periode dan shift terakhir selesai serta tinjauan absensi tuntas."
                  : "Fee event dapat difinalkan setelah event selesai dan tinjauan absensi tuntas."}{" "}
                Aplikasi mencatat pembayaran, tidak mentransfer uang.
              </p>
            </section>
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
            <PayrollList rows={rows} onDetail={show} management />
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
        title={`Aturan Periode · ${month}`}
        size="lg"
      >
        {data && (
          <div className="space-y-4">
            {actionError && (
              <p className="ui-error p-3 rounded-xl" role="alert">
                {actionError}
              </p>
            )}
            <p className="text-sm text-slate-600">
              Berlaku untuk seluruh draft pada periode {month}. Pengaturan ini
              terpisah dari penyesuaian per karyawan.
            </p>
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
        open={!!detail && !policyOpen}
        onClose={close}
        title={`Detail Payroll${detail ? " · " + detail.person.full_name : ""}`}
        size="lg"
      >
        {detail && (
          <div className="space-y-5">
            <section
              className="rounded-xl bg-slate-50 p-4 space-y-2"
              aria-label="Langkah slip payroll"
            >
              <p className="font-semibold">
                {detail.status === "DRAFT"
                  ? "Draft · Periksa sebelum finalisasi"
                  : detail.status === "FINAL"
                    ? "Final · Menunggu pembayaran"
                    : "Dibayar · Pembayaran sudah tercatat"}
              </p>
              <p className="text-sm text-slate-600">
                {detail.status === "DRAFT"
                  ? "Menyimpan penyesuaian tidak mengubah status. Tekan Finalkan payroll setelah semua syarat terpenuhi."
                  : detail.status === "FINAL"
                    ? "Bayarkan nominal final kepada karyawan, lalu catat tanggal dan referensinya di sini."
                    : "Tanggal dan referensi pembayaran tersimpan pada slip ini."}
              </p>
              {detail.status === "DRAFT" && detail.blockedReason && (
                <div className="rounded-xl bg-amber-50 p-3 space-y-2">
                  <p className="font-semibold text-sm text-amber-900">
                    Belum bisa difinalkan
                  </p>
                  <p className="text-sm text-amber-800">
                    {detail.blockedReason}
                  </p>
                  {!data?.configured ? (
                    <button
                      className={button}
                      onClick={() => {
                        setActionError("")
                        setPolicyOpen(true)
                      }}
                    >
                      Atur periode sekarang
                    </button>
                  ) : (
                    onAttendance &&
                    !!(detail.pendingCount || detail.pendingOvertime) && (
                      <button className={button} onClick={onAttendance}>
                        Buka tinjauan absensi
                      </button>
                    )
                  )}
                </div>
              )}
              {detail.status === "DRAFT" && detail.baseRate === 0 && (
                <p className="text-sm text-amber-800">
                  Gaji atau tarif masih Rp0. Periksa profil karyawan atau isi
                  penyesuaian slip jika perlu.
                </p>
              )}
            </section>
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
                      <p className="text-sm font-semibold">
                        Nominal yang dicatat: {money(detail.total)}
                      </p>
                    )}
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
