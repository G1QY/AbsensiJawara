import { useState } from "react"
import { money, button, primary, control, panel } from "../admin/adminData"
import { DataTable, Stat } from "../admin/adminWidgets"
import { accountRoles } from "../../lib/accountRoles"
import { stamp } from "../admin/attendanceData"
import {
  type PayrollEntry,
  type PayrollPolicy,
  type Adjustment,
  payrollExport,
  statusLabel,
  basisLabel,
} from "./payrollApi"
import { downloadWorkbook } from "../../lib/xlsxExport"
import { exportToPDF } from "../../utils/exportUtils"
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        value === "PAID"
          ? "bg-emerald-50 text-emerald-700"
          : value === "FINAL"
            ? "bg-blue-50 text-blue-700"
            : "bg-amber-50 text-amber-800"
      }`}
    >
      {statusLabel(value)}
    </span>
  )
}
export function PayrollTotals({ rows }: { rows: PayrollEntry[] }) {
  const sum = (
    key: "total" | "cappedDeduction" | "allowance" | "overtimeBonus",
  ) => rows.reduce((n, r) => n + r[key], 0)
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Gaji Bersih"
        value={money(sum("total"))}
        sub={`${rows.length} slip sesuai filter`}
      />
      <Stat
        label="Total Potongan"
        value={money(sum("cappedDeduction"))}
        tone="red"
      />
      <Stat
        label="Total Tambahan"
        value={money(sum("allowance") + sum("overtimeBonus"))}
        tone="green"
      />
      <Stat
        label="Sudah Dibayar"
        value={money(
          rows
            .filter((r) => r.status === "PAID")
            .reduce((n, r) => n + r.total, 0),
        )}
        sub={`${rows.filter((r) => r.status === "PAID").length} dari ${rows.length} slip`}
        tone="plain"
      />
    </div>
  )
}
export function PayrollExports({
  rows,
  month,
  onError,
}: {
  rows: PayrollEntry[]
  month: string
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  async function pdf() {
    setBusy(true)
    try {
      const sheet = payrollExport(rows)
      await exportToPDF(
        `Payroll ${month}`,
        "Status Draft, Final, dan Dibayar mengikuti catatan payroll.",
        sheet[0] as string[],
        sheet.slice(1),
      )
    } catch (e) {
      onError(e instanceof Error ? e.message : "Ekspor gagal.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={button}
        disabled={busy || !rows.length}
        onClick={() =>
          downloadWorkbook(payrollExport(rows), `Payroll-${month}.xlsx`)
        }
      >
        Export Excel
      </button>
      <button
        className={primary}
        disabled={busy || !rows.length}
        onClick={() => void pdf()}
      >
        Export PDF
      </button>
    </div>
  )
}
export function PayrollList({
  rows,
  onDetail,
}: {
  rows: PayrollEntry[]
  onDetail: (r: PayrollEntry) => void
}) {
  return (
    <>
      <div className="hidden lg:block">
        <DataTable
          headers={[
            "Karyawan",
            "Penempatan",
            "Gaji / Fee",
            "Potongan",
            "Tambahan",
            "Gaji Bersih",
            "Status",
            "Aksi",
          ]}
          rows={rows.map((r) => [
            <div>
              <p className="font-semibold">{r.person.full_name}</p>
              <p className="text-xs text-slate-500">
                {accountRoles[r.person.role] || r.person.role}
                {r.person.division ? " · " + r.person.division : ""}
              </p>
            </div>,
            r.placements.map((p) => p.name).join(", ") || "Belum ditempatkan",
            money(r.base),
            <span className="text-red-700">−{money(r.cappedDeduction)}</span>,
            <span className="text-emerald-700">
              +{money(r.allowance + r.overtimeBonus)}
            </span>,
            <strong>{money(r.total)}</strong>,
            <Status value={r.status} />,
            <button
              className={button}
              aria-label={`Detail payroll ${r.person.full_name}${
                r.event ? " " + r.event.name : ""
              }`}
              onClick={() => onDetail(r)}
            >
              Detail
            </button>,
          ])}
        />
      </div>
      <div className="grid gap-3 lg:hidden">
        {rows.map((r) => (
          <article key={r.key} className={panel}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {r.person.full_name}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {accountRoles[r.person.role] || r.person.role}
                  {r.person.division ? " · " + r.person.division : ""}
                </p>
              </div>
              <Status value={r.status} />
            </div>
            <p className="text-sm text-slate-600 mt-3 break-words">
              {r.placements.map((p) => p.name).join(", ") ||
                "Belum ditempatkan"}
            </p>
            <div className="grid grid-cols-2 gap-3 my-4 text-xs">
              <div>
                Gaji / fee
                <p className="mt-1 text-sm font-medium">{money(r.base)}</p>
              </div>
              <div>
                Potongan
                <p className="mt-1 text-sm font-medium text-red-700">
                  −{money(r.cappedDeduction)}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500">Gaji bersih</p>
                <strong className="text-lg text-blue-700">
                  {money(r.total)}
                </strong>
              </div>
              <button
                className={button}
                aria-label={`Detail payroll ${r.person.full_name}${
                  r.event ? " " + r.event.name : ""
                }`}
                onClick={() => onDetail(r)}
              >
                Detail
              </button>
            </div>
          </article>
        ))}
        {!rows.length && (
          <p className={panel + " text-sm text-slate-500"}>
            Tidak ada payroll sesuai filter.
          </p>
        )}
      </div>
    </>
  )
}
export function PayrollDetails({ row: r }: { row: PayrollEntry }) {
  const lines: [string, string][] = [
    ["Dasar gaji", basisLabel(r.basis)],
    [`Gaji / fee (${r.units} × ${money(r.baseRate)})`, money(r.base)],
    ["Tunjangan / tambahan", money(r.allowance)],
  ]
  if (r.kind === "MONTHLY")
    lines.push(
      [
        `Lembur disetujui (${r.overtimeHours} jam × ${money(r.policy.overtime_rate)})`,
        money(r.overtimeBonus),
      ],
      [`Potongan telat (${r.lateMinutes} menit)`, "−" + money(r.lateDeduction)],
      [
        `Potongan absen (${r.absentDays} dari ${r.scheduledDays} hari)`,
        "−" + money(r.absenceDeduction),
      ],
    )
  lines.push(["Potongan manual", "−" + money(r.manualDeduction)], [
    "Gaji bersih",
    money(r.total),
  ])
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-blue-600 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            {r.month} ·{" "}
            {r.kind === "EVENT" ? "Payroll Event" : "Payroll Bulanan"}
          </p>
          <Status value={r.status} />
        </div>
        <p className="mt-4 text-sm text-blue-100">Gaji bersih</p>
        <p className="text-2xl sm:text-3xl font-bold mt-1 break-words">
          {money(r.total)}
        </p>
        <p className="text-sm mt-3">
          {r.placements.map((p) => p.name).join(", ") || "Belum ditempatkan"}
        </p>
      </section>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Karyawan</p>
          <p className="font-medium mt-1">{r.person.full_name}</p>
          <p className="text-xs text-slate-500 mt-1">
            {r.person.employee_code} ·{" "}
            {accountRoles[r.person.role] || r.person.role}
          </p>
          {r.person.division && (
            <p className="text-xs mt-1">{r.person.division}</p>
          )}
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Kehadiran</p>
          <p className="font-medium mt-1">{r.presentDays} hari disetujui</p>
          <p className="text-xs text-slate-500 mt-1">
            {r.pendingCount} menunggu tinjauan
          </p>
        </div>
      </div>
      <dl className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {lines.map(([label, value]) => (
          <div
            className="flex flex-wrap justify-between gap-2 p-4 text-sm last:font-bold last:text-blue-700"
            key={label}
          >
            <dt className="sm:max-w-[70%]">{label}</dt>
            <dd className="ml-auto whitespace-nowrap">{value}</dd>
          </div>
        ))}
      </dl>
      {r.deduction > r.cappedDeduction && (
        <p className="text-xs text-slate-500">
          Potongan diterapkan maksimal sebesar pendapatan. Sisa potongan tidak
          dibawa otomatis ke bulan berikutnya.
        </p>
      )}
      {r.adjustment.note && (
        <div className="rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-medium mb-1">Catatan penyesuaian</p>
          <p className="whitespace-pre-wrap break-words">{r.adjustment.note}</p>
        </div>
      )}
      {r.absentDates.length > 0 && (
        <p className="text-xs text-slate-500">
          Tanggal tanpa kehadiran sah: {r.absentDates.join(", ")}.
        </p>
      )}
      {r.blockedReason && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {r.blockedReason}
        </p>
      )}
      {r.status === "PAID" && (
        <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Pembayaran tercatat · {r.paidDate}</p>
          <p className="mt-1 break-words">{r.paymentReference}</p>
        </div>
      )}
      <details className="rounded-xl border border-slate-200 p-4">
        <summary className="text-sm font-semibold cursor-pointer">
          Rincian absensi ({r.attendance.length})
        </summary>
        <div className="mt-3 divide-y divide-slate-100">
          {r.attendance.map((a) => (
            <div key={a.id} className="py-3 text-xs">
              <div className="flex justify-between gap-3">
                <strong>{a.date}</strong>
                <span>
                  {({
                    APPROVED: "Disetujui",
                    PENDING: "Menunggu admin",
                    REJECTED: "Ditolak",
                    NOT_REQUIRED: "Tercatat",
                  } as Record<string, string>)[a.review] || a.review}
                </span>
              </div>
              <p className="mt-1 text-slate-500">
                {stamp(a.checkIn)} → {stamp(a.checkOut)}
              </p>
              <p className="mt-1">
                Telat {a.lateMinutes} menit · Lembur {a.overtimeMinutes} menit (
                {a.overtimeStatus === "APPROVED"
                  ? "disetujui"
                  : a.overtimeStatus === "PENDING"
                    ? "menunggu"
                    : "tidak disetujui"}
                )
              </p>
            </div>
          ))}
          {!r.attendance.length && (
            <p className="text-sm text-slate-500">Belum ada absensi.</p>
          )}
        </div>
      </details>
    </div>
  )
}
export function RupiahInput({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  optional?: boolean
}) {
  return (
    <label className="block text-sm text-slate-600">
      {label}
      <input
        className={control + " mt-1"}
        inputMode="numeric"
        value={value}
        placeholder={optional ? "Ikuti gaji di profil" : "0"}
        onChange={(e) => {
          if (/^\d{0,10}$/.test(e.target.value)) onChange(e.target.value)
        }}
        onFocus={(e) => e.target.select()}
      />
    </label>
  )
}
export function PolicyForm({
  policy,
  busy,
  onSave,
}: {
  policy: PayrollPolicy
  busy: boolean
  onSave: (p: PayrollPolicy) => void
}) {
  const [p, setP] = useState(policy),
    [rates, setRates] = useState({
      late_rate: String(policy.late_rate),
      overtime_rate: String(policy.overtime_rate),
      absence_rate: String(policy.absence_rate),
    })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          ...p,
          late_rate: Number(rates.late_rate),
          overtime_rate: Number(rates.overtime_rate),
          absence_rate: Number(rates.absence_rate),
        })
      }}
    >
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-slate-600">
            Dasar gaji Store & Kantor
            <select
              className={control + " mt-1"}
              aria-label="Dasar gaji Store & Kantor"
                value={p.monthly_basis}
              onChange={(e) =>
                setP({
                  ...p,
                  monthly_basis: e.target
                    .value as PayrollPolicy["monthly_basis"],
                })
              }
            >
              <option value="MONTHLY">Per bulan</option>
              <option value="PER_ATTENDANCE">Per hari hadir disetujui</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Dasar fee Crew Event
            <select
              className={control + " mt-1"}
              aria-label="Dasar fee Crew Event"
                value={p.event_basis}
              onChange={(e) =>
                setP({
                  ...p,
                  event_basis: e.target.value as PayrollPolicy["event_basis"],
                })
              }
            >
              <option value="PER_ATTENDANCE">Per hari hadir disetujui</option>
              <option value="PER_EVENT">Per event selesai</option>
            </select>
          </label>
          <RupiahInput
            label="Potongan telat per jam (Rp)"
            value={rates.late_rate}
            onChange={(v) => setRates({ ...rates, late_rate: v })}
          />
          <label className="text-sm text-slate-600">
            Perhitungan telat
            <select
              className={control + " mt-1"}
              aria-label="Perhitungan telat"
                value={p.late_rounding}
              onChange={(e) =>
                setP({
                  ...p,
                  late_rounding: e.target
                    .value as PayrollPolicy["late_rounding"],
                })
              }
            >
              <option value="MINUTE">Proporsional per menit</option>
              <option value="HOUR_CEIL">Bulat ke atas per jam per hari</option>
            </select>
          </label>
          <RupiahInput
            label="Tambahan lembur per jam (Rp)"
            value={rates.overtime_rate}
            onChange={(v) => setRates({ ...rates, overtime_rate: v })}
          />
          <label className="text-sm text-slate-600">
            Potongan tanpa kehadiran
            <select
              className={control + " mt-1"}
              aria-label="Potongan tanpa kehadiran"
                value={p.absence_mode}
              onChange={(e) =>
                setP({
                  ...p,
                  absence_mode: e.target.value as PayrollPolicy["absence_mode"],
                })
              }
            >
              <option value="NONE">Tidak dipotong</option>
              <option value="SCHEDULED">Gaji bulanan ÷ hari terjadwal</option>
              <option value="FIXED">Nominal tetap per hari</option>
            </select>
          </label>
          {p.absence_mode === "FIXED" && (
            <RupiahInput
              label="Potongan absen per hari (Rp)"
              value={rates.absence_rate}
              onChange={(v) => setRates({ ...rates, absence_rate: v })}
            />
          )}
        </div>
        <p className="text-xs text-slate-500">
          Aturan telat, absen, dan lembur berlaku untuk payroll bulanan. Crew
          Event memakai fee event dan penyesuaian manual. Slip final tetap
          memakai aturan saat difinalkan.
        </p>
        <button className={primary} type="submit">
          {busy ? "Menyimpan..." : "Simpan aturan payroll"}
        </button>
      </fieldset>
    </form>
  )
}
export function AdjustmentForm({
  row,
  busy,
  onSave,
}: {
  row: PayrollEntry
  busy: boolean
  onSave: (a: Adjustment) => void
}) {
  const [a, setA] = useState({
    rate_override:
      row.adjustment.rate_override === null
        ? ""
        : String(row.adjustment.rate_override),
    allowance: String(row.adjustment.allowance),
    deduction: String(row.adjustment.deduction),
    note: row.adjustment.note,
  })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          rate_override:
            a.rate_override === "" ? null : Number(a.rate_override),
          allowance: Number(a.allowance),
          deduction: Number(a.deduction),
          note: a.note,
        })
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        <RupiahInput
          label={
            row.kind === "EVENT"
              ? "Tarif fee event (Rp)"
              : "Gaji pokok periode ini (Rp)"
          }
          value={a.rate_override}
          optional
          onChange={(v) => setA({ ...a, rate_override: v })}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <RupiahInput
            label="Tunjangan / tambahan (Rp)"
            value={a.allowance}
            onChange={(v) => setA({ ...a, allowance: v })}
          />
          <RupiahInput
            label="Potongan manual (Rp)"
            value={a.deduction}
            onChange={(v) => setA({ ...a, deduction: v })}
          />
        </div>
        <label className="block text-sm text-slate-600">
          Catatan penyesuaian
          <textarea
            className={control + " !rounded-xl mt-1 min-h-24"}
            maxLength={1000}
            value={a.note}
            onChange={(e) => setA({ ...a, note: e.target.value })}
          />
        </label>
        <p className="text-xs text-slate-500">
          Berlaku untuk slip ini. Kosongkan tarif untuk mengikuti gaji pada
          profil karyawan.
        </p>
        <button className={primary} type="submit">
          {busy ? "Menyimpan..." : "Simpan penyesuaian"}
        </button>
      </fieldset>
    </form>
  )
}
