const db = require("../../config/supabaseClient")
const { fail } = require("../crew/crew.validation")
const DEFAULT_POLICY = Object.freeze({
  monthly_basis: "MONTHLY",
  late_rate: 0,
  late_rounding: "MINUTE",
  overtime_rate: 0,
  absence_mode: "NONE",
  absence_rate: 0,
  event_basis: "PER_ATTENDANCE",
})
const dateWib = (value) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(value)
function period(value) {
  if (typeof value !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))
    throw fail("Periode payroll harus berupa YYYY-MM.")
  return value + "-01"
}
function check(error) {
  if (!error) return
  if (error.code === "40001" || error.code === "23505")
    throw fail("Data payroll berubah atau sudah final. Muat ulang.", 409)
  if (error.code === "42501") throw fail("Akses payroll ditolak.", 403)
  if (["PGRST202", "42P01", "42883"].includes(error.code))
    throw fail("Migrasi payroll V13 belum terpasang.", 503)
  throw fail(
    error.code === "P0001" ? error.message : "Payroll tidak dapat diproses.",
    422,
  )
}
const money = (n) => Math.round(Math.max(0, Number(n) || 0))
const approved = (a) =>
  a.check_in &&
  a.check_out &&
  ["PRESENT", "ON_TIME", "LATE"].includes(a.status) &&
  ["APPROVED", "NOT_REQUIRED"].includes(a.review_status)
function ended(s, now) {
  const start = new Date(`${s.schedule_date}T${s.start_time}+07:00`),
    end = new Date(`${s.schedule_date}T${s.end_time}+07:00`)
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1)
  return end <= now
}
function calculate(source, month, now = new Date()) {
  const policy = source.policy || DEFAULT_POLICY,
    rows = [],
    today = dateWib(now)
  const {
    people = [],
    placements = [],
    assignments = [],
    attendance = [],
    schedules = [],
    eventSchedules = [],
    permissions = [],
    adjustments = [],
    slips = [],
  } = source
  const [year, m] = month.split("-").map(Number),
    lastDay = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
  for (const person of people) {
    const own = attendance.filter((a) => a.crew_id === person.id),
      places = placements.filter((a) => a.crew_id === person.id)
    const eventIds = [
      ...new Set(
        assignments
          .filter(
            (a) => a.crew_id === person.id && a.event_status !== "CANCELLED",
          )
          .map((a) => a.event_id),
      ),
    ]
    const monthly =
      (person.crew_type !== "CREW_EVENT" && person.status === "ACTIVE") ||
        schedules.some((s) => s.crew_id === person.id) ||
        own.some((a) => a.store_assignment_id)
    for (const scopeKey of [...(monthly ? ["MONTHLY"] : []), ...eventIds]) {
      const isEvent = scopeKey !== "MONTHLY",
        eventAssignments = assignments.filter(
          (a) => a.crew_id === person.id && a.event_id === scopeKey,
        ),
        event = eventAssignments[0]
      const logs = own.filter((a) =>
        isEvent
          ? eventAssignments.some((e) => e.id === a.event_assignment_id)
          : a.store_assignment_id && a.attendance_date.startsWith(month),
      )
      const valid = logs.filter(approved),
        validDates = new Set(valid.map((a) => a.attendance_date))
      const work = isEvent
        ? eventSchedules.filter(
            (s) =>
              s.crew_id === person.id &&
              s.event_id === scopeKey &&
              s.status === "ACTIVE",
          )
        : schedules.filter((s) => s.crew_id === person.id)
      const due = work.filter((s) => ended(s, now)),
        scheduledDates = [...new Set(work.map((s) => s.schedule_date))]
      const ownPermissions = permissions.filter((p) => p.crew_id === person.id)
      const unresolved = logs.filter(
        (a) =>
          a.check_in &&
          (a.review_status === "PENDING" ||
            (["APPROVED", "NOT_REQUIRED"].includes(a.review_status) &&
              !a.check_out)),
      )
      const pendingPermissionDates = scheduledDates.filter((d) =>
        ownPermissions.some(
          (p) => p.status === "PENDING" && d >= p.start_date && d <= p.end_date,
        ),
      )
      const absentDates = isEvent
        ? []
        : [...new Set(due.map((s) => s.schedule_date))].filter(
            (d) =>
              !validDates.has(d) &&
              !unresolved.some((a) => a.attendance_date === d) &&
              !ownPermissions.some(
                (p) =>
                  ["APPROVED", "PENDING"].includes(p.status) &&
                  d >= p.start_date &&
                  d <= p.end_date,
              ),
          )
      const adjustment = adjustments.find(
        (a) => a.crew_id === person.id && a.scope_key === scopeKey,
      ) || { rate_override: null, allowance: 0, deduction: 0, note: "" }
      const baseRate = money(adjustment.rate_override ?? person.base_salary),
        basis = isEvent ? policy.event_basis : policy.monthly_basis
      const units =
          basis === "MONTHLY"
            ? 1
            : basis === "PER_EVENT"
              ? valid.length
                ? 1
                : 0
              : validDates.size,
        base = money(baseRate * units)
      const lateMinutes = valid.reduce((n, a) => n + money(a.late_minutes), 0)
      const lateUnits =
        policy.late_rounding === "MINUTE"
          ? lateMinutes / 60
          : valid.reduce((n, a) => n + Math.ceil(money(a.late_minutes) / 60), 0)
      const overtimeHours = valid
        .filter((a) => a.overtime_status === "APPROVED")
        .reduce((n, a) => n + Math.floor(money(a.overtime_minutes) / 60), 0)
      const lateDeduction = isEvent ? 0 : money(lateUnits * policy.late_rate),
        overtimeBonus = isEvent
          ? 0
          : money(overtimeHours * policy.overtime_rate)
      const dailyRate =
        basis === "MONTHLY"
          ? policy.absence_mode === "FIXED"
            ? money(policy.absence_rate)
            : scheduledDates.length
              ? base / scheduledDates.length
              : 0
          : 0
      const absenceDeduction =
        !isEvent && basis === "MONTHLY" && policy.absence_mode !== "NONE"
          ? money(dailyRate * absentDates.length)
          : 0
      const allowance = money(adjustment.allowance),
        manualDeduction = money(adjustment.deduction),
        deduction = lateDeduction + absenceDeduction + manualDeduction
      const gross = base + overtimeBonus + allowance,
        total = Math.max(0, gross - deduction),
        cappedDeduction = Math.min(gross, deduction)
      const pendingOvertime = logs.filter(
        (a) => a.overtime_status === "PENDING",
      ).length
      let blockedReason = !source.policy
        ? "Simpan aturan payroll periode ini."
        : unresolved.length || pendingPermissionDates.length
          ? "Selesaikan tinjauan absensi dan izin terlebih dahulu."
          : !isEvent && pendingOvertime
            ? "Selesaikan persetujuan lembur terlebih dahulu."
            : !isEvent && (today <= lastDay || work.some((s) => !ended(s, now)))
              ? "Periode kerja belum selesai."
              : isEvent &&
                  (event?.event_status !== "COMPLETED" ||
                    work.some((s) => !ended(s, now)))
                ? "Event belum selesai."
                : null
      if (person.join_date > lastDay) continue
      rows.push({
        key: person.id + ":" + scopeKey,
        crewId: person.id,
        userId: person.user_id,
        scopeKey,
        month,
        kind: isEvent ? "EVENT" : "MONTHLY",
        person,
        event: isEvent
          ? {
              id: event.event_id,
              name: event.event_name,
              date: event.event_date,
              endDate: event.end_date,
            }
          : null,
        placements: isEvent
          ? [{ id: scopeKey, name: event.event_name, kind: "EVENT" }]
          : [
              ...new Map(
                places.map((p) => [
                  p.store_id,
                  { id: p.store_id, name: p.name, kind: p.location_kind },
                ]),
              ).values(),
            ],
        policy: { ...policy },
        adjustment,
        baseRate,
        basis,
        units,
        base,
        lateMinutes,
        lateUnits,
        overtimeHours,
        lateDeduction,
        absenceDeduction,
        absentDays: absentDates.length,
        absentDates,
        scheduledDays: scheduledDates.length,
        dailyRate,
        presentDays: validDates.size,
        pendingCount: unresolved.length + pendingPermissionDates.length,
        pendingOvertime,
        excluded: logs.length - valid.length,
        overtimeBonus,
        allowance,
        manualDeduction,
        deduction,
        cappedDeduction,
        total,
        attendance: logs.map((a) => ({
          id: a.id,
          date: a.attendance_date,
          checkIn: a.check_in,
          checkOut: a.check_out,
          review: a.review_status,
          lateMinutes: money(a.late_minutes),
          overtimeMinutes: money(a.overtime_minutes),
          overtimeStatus: a.overtime_status,
        })),
        status: "DRAFT",
        blockedReason,
      })
    }
  }
  // Final slips never change when salaries, rules or attendance change later.
  for (const slip of slips) {
    const row = {
      ...slip.snapshot,
      status: slip.status,
      slipId: slip.id,
      finalizedAt: slip.finalized_at,
      paidDate: slip.paid_date,
      paymentReference: slip.payment_reference,
      blockedReason: null,
    }
    const index = rows.findIndex((r) => r.key === row.key)
    if (index < 0) rows.push(row)
    else rows[index] = row
  }
  return rows.sort(
    (a, b) =>
      a.person.full_name.localeCompare(b.person.full_name) ||
      a.scopeKey.localeCompare(b.scopeKey),
  )
}
async function workspace(month, userId = null) {
  const { data, error } = await db.rpc("payroll_workspace", {
    p_period: period(month),
    p_user: userId,
  })
  check(error)
  if (!data?.source) throw fail("Data payroll tidak tersedia.", 503)
  return {
    month,
    revision: data.revision,
    policy: data.source.policy || { ...DEFAULT_POLICY },
    configured: !!data.source.policy,
    rows: calculate(data.source, month),
  }
}
module.exports = { DEFAULT_POLICY, period, check, calculate, workspace }
