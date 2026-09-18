import { t, getLocale } from "./i18n"
export interface AttendanceStatusFields {
  status: string
  check_in?: string | null
  check_out?: string | null
  late_minutes?: number | null
  overtime_status?: string | null
  overtime_minutes?: number | null
}
export function arrivalLabel(row: AttendanceStatusFields) {
  const labels: Record<string, string> = {
    PRESENT: "Tepat waktu",
    LATE: "Terlambat",
    PENDING: "Menunggu verifikasi",
    ABSENT: "Tidak hadir",
    PERMISSION: "Izin",
    SICK: "Sakit",
    REJECTED: "Ditolak",
  }
  return t(labels[row.status] || row.status)
}
export function overtimeLabel(row: AttendanceStatusFields) {
  if (!row.check_out) return t("Belum clock-out")
  const labels: Record<string, string> = {
    NONE: "Tidak lembur",
    PENDING: "Menunggu persetujuan",
    APPROVED: "Lembur disetujui",
    REJECTED: "Lembur ditolak",
  }
  const label = t(labels[row.overtime_status || "NONE"] || "Belum dihitung")
  return (row.overtime_minutes || 0) > 0
    ? `${label} (${row.overtime_minutes} ${t("menit")})`
    : label
}
export const attendanceStamp = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString(getLocale(), { timeZone: "Asia/Jakarta" })
    : t("Belum ada")
