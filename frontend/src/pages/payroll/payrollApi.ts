import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "../../lib/apiClient"
import { message } from "../admin/adminData"
export type PayrollPolicy = {
  monthly_basis: "MONTHLY" | "PER_ATTENDANCE"
  late_rate: number
  late_rounding: "MINUTE" | "HOUR_CEIL"
  overtime_rate: number
  absence_mode: "NONE" | "SCHEDULED" | "FIXED"
  absence_rate: number
  event_basis: "PER_ATTENDANCE" | "PER_EVENT"
}
export type Adjustment = {
  rate_override: number | null
  allowance: number
  deduction: number
  note: string
}
export type PayrollEntry = {
  key: string
  crewId: string
  userId: string
  scopeKey: string
  month: string
  kind: "MONTHLY" | "EVENT"
  person: {
    full_name: string
    email: string
    employee_code: string
    company_name: string
    job_title: string
    division: string
    role: string
    branch_name: string
    city_name: string
  }
  event: { id: string, name: string, date: string, endDate: string } | null
  placements: { id: string, name: string, kind: string }[]
  policy: PayrollPolicy
  adjustment: Adjustment
  basis: string
  baseRate: number
  units: number
  base: number
  lateMinutes: number
  lateUnits: number
  overtimeHours: number
  lateDeduction: number
  absenceDeduction: number
  absentDays: number
  absentDates: string[]
  scheduledDays: number
  dailyRate: number
  presentDays: number
  pendingCount: number
  pendingOvertime: number
  excluded: number
  overtimeBonus: number
  allowance: number
  manualDeduction: number
  deduction: number
  cappedDeduction: number
  total: number
  status: "DRAFT" | "FINAL" | "PAID"
  blockedReason: string | null
  slipId?: string
  finalizedAt?: string
  paidDate?: string
  paymentReference?: string
  attendance: {
    id: string
    date: string
    checkIn: string
    checkOut: string
    review: string
    lateMinutes: number
    overtimeMinutes: number
    overtimeStatus: string
  }[]
}
export type PayrollWorkspaceData = {
  month: string
  revision: string
  policy: PayrollPolicy
  configured: boolean
  rows: PayrollEntry[]
}
export const currentMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
    .format(new Date())
    .slice(0, 7)
export const statusLabel = (s: string) =>
  ({ DRAFT: "Draft", FINAL: "Final", PAID: "Dibayar" })[s] || s
export const basisLabel = (s: string) =>
  ({
    MONTHLY: "Per bulan",
    PER_EVENT: "Per event selesai",
    PER_ATTENDANCE: "Per hari hadir disetujui",
  })[s] || s
export function usePayroll(month: string, path = "/payroll") {
  const [data, setData] = useState<PayrollWorkspaceData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("")
  const request = useRef(0)
  const reload = useCallback(async () => {
    const n = ++request.current
    setLoading(true)
    setError("")
    try {
      const result = await api.get<PayrollWorkspaceData>(
        `${path}?month=${month}`,
      )
      if (n === request.current) setData(result)
    } catch (e) {
      if (n === request.current) {
        setData(null)
        setError(message(e))
      }
    } finally {
      if (n === request.current) setLoading(false)
    }
  }, [month, path])
  useEffect(() => {
    setData(null)
    void reload()
    return () => {
      request.current++
    }
  }, [reload])
  return { data, loading, error, reload }
}
export function payrollExport(rows: PayrollEntry[]) {
  return [
    [
      "Periode",
      "Kode karyawan",
      "Nama",
      "Role",
      "Divisi",
      "Perusahaan",
      "Jabatan",
      "Cabang",
      "Sistem",
      "Penempatan",
      "Dasar gaji",
      "Tarif",
      "Unit",
      "Gaji",
      "Hadir",
      "Absen",
      "Menit telat",
      "Potongan telat",
      "Potongan absen",
      "Lembur disetujui (jam)",
      "Tambahan lembur",
      "Tunjangan / tambahan",
      "Potongan manual",
      "Potongan diterapkan",
      "Gaji bersih",
      "Status",
      "Catatan",
      "Tanggal bayar",
      "Referensi pembayaran",
    ],
    ...rows.map((r) => [
      r.month,
      r.person.employee_code,
      r.person.full_name,
      r.person.role,
      r.person.division,
      r.person.company_name,
      r.person.job_title || "",
      [r.person.city_name, r.person.branch_name].filter(Boolean).join(" / "),
      r.kind === "EVENT" ? "Event" : "Bulanan",
      r.placements.map((p) => p.name).join(", "),
      basisLabel(r.basis),
      r.baseRate,
      r.units,
      r.base,
      r.presentDays,
      r.absentDays,
      r.lateMinutes,
      r.lateDeduction,
      r.absenceDeduction,
      r.overtimeHours,
      r.overtimeBonus,
      r.allowance,
      r.manualDeduction,
      r.cappedDeduction,
      r.total,
      statusLabel(r.status),
      r.adjustment.note,
      r.paidDate || "",
      r.paymentReference || "",
    ]),
  ]
}
