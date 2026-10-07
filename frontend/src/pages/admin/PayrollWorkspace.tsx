import PayrollBatchForm, {PolicyReview} from '../payroll/PayrollReviewForms';
import { useState } from "react"
import { api } from "../../lib/apiClient"
import { button, primary, control, panel, message, money } from "./adminData"
import Modal from "../../components/ui/Modal"
import {
  type PayrollEntry,
  currentMonth,
  payrollDate,
  usePayroll,
} from "../payroll/payrollApi"
import {
  PayrollTotals,
  PayrollExports,
  PayrollList,
  PayrollDetails,
  AdjustmentForm,
} from "../payroll/PayrollComponents"
export default function PayrollWorkspace({
  onAttendance,
}: {
  onAttendance?: () => void
}) {
  const [month, setMonth] = useState(currentMonth),
    [kind, setKind] = useState("ALL"),
    [placementKind, setPlacementKind] = useState(""),
    [placement, setPlacement] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("")
  const [batchOpen,setBatchOpen]=useState(false),[dirty,setDirty]=useState(false),[readiness,setReadiness]=useState("");
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
      (kind === "ALL" || r.kind === kind) &&
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
      (!readiness || (r.status === "DRAFT" && (readiness === "READY" ? !r.blockedReason : !!r.blockedReason))) &&
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
      setBatchOpen(false)
      setDirty(false)
      setConfirm("")
      setReference("")
      const notices: Record<string, string> = {
        policy:
          "Aturan periode " + month + " tersimpan. Draft mengikuti aturan ini.",
        "year-policy": `Aturan tahun ${payload.year} tersimpan mulai bulan ${payload.fromMonth}. Slip final/dibayar tetap.`,
        "batch-adjustments": "Penyesuaian seluruh draft terpilih tersimpan. Periksa rincian sebelum finalisasi.",
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
    setDirty(false)
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
            Atur aturan tahunan
          </button>
        </div>
      </header>
      {(error || (!detail && !policyOpen && !batchOpen && actionError)) && (
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
            className="flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1"
            role="tablist"
            aria-label="Sistem payroll"
          >
            {[
              ["ALL", "Semua crew"],
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
                  setPolicyOpen(false)
                  setBatchOpen(false)
                  setDetailKey(null)
                  setNotice("")
                }
              }}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {kind !== "EVENT" && (
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
              <option value="EVENT">Event</option>
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
            onChange={(e) => {setStatus(e.target.value);setReadiness("")}}
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
                  <h2 className="font-semibold">Aturan tahunan & pembayaran</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {data.configured
                      ? data.policy.annual_year ? `Mengikuti aturan tahun ${data.policy.annual_year}. Periksa draft sebelum finalisasi.` : `Masih memakai aturan bulanan lama untuk ${month}. Anda dapat mengaturnya secara tahunan.`
                      : `Aturan ${month} belum disimpan. Atur tahun ini agar berlaku otomatis sampai Desember.`}
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
                    ? "Lihat aturan tahunan"
                    : "Atur tahun sekarang"}
                </button>
              </div>
              {data.calendar&&<div className="grid sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <p>Periode perhitungan<strong className="block mt-1">{payrollDate(data.calendar.startDate)} – {payrollDate(data.calendar.endDate)}</strong></p>
                <p>Rencana pembayaran<strong className="block mt-1">{payrollDate(data.calendar.paymentDate)}</strong></p>
                <p>Lembur: <strong>{money(data.policy.overtime_rate)}/jam disetujui</strong></p>
                <p>Telat: <strong>{money(data.policy.late_rate)}/jam</strong> · {data.policy.late_rounding==='MINUTE'?'proporsional per menit':'bulat ke atas per absensi'}</p>
              </div>}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  {key:'REVIEW',label:'Perlu diperiksa',count:base.filter(r=>r.status==='DRAFT'&&r.blockedReason).length},
                  {key:'READY',label:'Siap difinalkan',count:base.filter(r=>r.status==='DRAFT'&&!r.blockedReason).length},
                  {key:'FINAL',label:'Menunggu pembayaran',count:base.filter(r=>r.status==='FINAL').length},
                  {key:'PAID',label:'Sudah dibayar',count:base.filter(r=>r.status==='PAID').length},
                ].map(step=><button key={step.key} aria-pressed={readiness===step.key||status===step.key} className={`text-left p-3 rounded-xl border ${readiness===step.key||status===step.key?'border-blue-600 bg-blue-50':'border-slate-200'}`} onClick={()=>{
                  if(step.key==='REVIEW'||step.key==='READY'){setReadiness(readiness===step.key?'':step.key);setStatus('')}
                  else {setStatus(status===step.key?'':step.key);setReadiness('')}
                }}><strong className="text-xl block">{step.count}</strong><span className="text-xs text-slate-600">{step.label}</span></button>)}
              </div>
              {readiness&&<button className={button} onClick={()=>setReadiness('')}>Hapus filter kesiapan</button>}
              <p className="text-xs text-slate-600">Aturan → periksa draft → finalkan → catat pembayaran. Gaji bulanan difinalkan setelah periode dan tinjauan selesai. Aplikasi mencatat pembayaran, tidak mentransfer uang.</p>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{rows.length} slip ditampilkan · {rows.filter(r=>r.status==='DRAFT').length} draft</p>
              <button className={primary} disabled={busy||!rows.some(r=>r.status==='DRAFT')} onClick={()=>{setActionError('');setBatchOpen(true)}}>Atur banyak crew</button>
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
        title="Aturan Payroll Tahunan"
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
              Tarif lembur, potongan telat, batas periode dan rencana tanggal bayar dikelola di sini.
              Penyesuaian per karyawan tetap tersedia pada detail slip.
            </p>
            <PolicyReview
              key={month + data.revision}
              data={data}
              busy={busy}
              onSave={(payload) => void save("year-policy", payload)}
            />
          </div>
        )}
      </Modal>
      <Modal open={batchOpen&&!!data} onClose={()=>{if(!busy){setBatchOpen(false);setActionError('')}}} title={`Atur Banyak Crew · ${month}`} size="lg">
        {actionError&&<p role="alert" className="ui-error p-3 rounded-xl mb-4">{actionError}</p>}
        {data&&batchOpen&&<PayrollBatchForm key={month+data.revision} data={data} rows={rows.filter(r=>r.status==='DRAFT')} busy={busy} onSave={(keys,patch)=>void save('batch-adjustments',{keys,patch})}/>}
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
                      Atur tahun sekarang
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
                    disabled={busy || dirty || !!detail.blockedReason}
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
            {dirty&&<p role="status" className="bg-amber-50 text-amber-900 rounded-xl p-3 text-sm">Ada perubahan komponen yang belum disimpan. Simpan penyesuaian sebelum finalisasi.</p>}
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
                    onDirty={setDirty}
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
