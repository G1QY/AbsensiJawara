const test = require("node:test"),
  assert = require("node:assert/strict")
const client = require.resolve("../src/config/supabaseClient")
require.cache[client] = {
  id: client,
  filename: client,
  loaded: true,
  exports: {},
}
const {
  calculate,
  DEFAULT_POLICY,
  period,
} = require("../src/modules/payroll/payroll.service")
const now = new Date("2026-10-02T00:00:00Z")
const person = {
  id: "crew",
  user_id: "user",
  full_name: "Personel",
  crew_type: "CREW_STORE",
  status: "ACTIVE",
  base_salary: 3000000,
  join_date: "2026-01-01",
}
const schedule = (day, start = "09:00", end = "17:00") => ({
  id: "s" + day,
  crew_id: "crew",
  schedule_date: "2026-09-" + String(day).padStart(2, "0"),
  start_time: start,
  end_time: end,
})
const log = (day, extra = {}) => ({
  id: "a" + day,
  crew_id: "crew",
  store_assignment_id: "store",
  attendance_date: schedule(day).schedule_date,
  check_in: schedule(day).schedule_date + "T02:00:00Z",
  check_out: schedule(day).schedule_date + "T10:00:00Z",
  status: "LATE",
  late_minutes: 15,
  overtime_minutes: 120,
  overtime_status: "APPROVED",
  review_status: "APPROVED",
  ...extra,
})
const source = (extra = {}) => ({
  people: [person],
  schedules: [schedule(1), schedule(2), schedule(3)],
  attendance: [log(1)],
  policy: {
    ...DEFAULT_POLICY,
    late_rate: 12000,
    overtime_rate: 10000,
    absence_mode: "SCHEDULED",
  },
  ...extra,
})
test("saved rates automatically affect salary, approved overtime and due absences", () => {
  const [r] = calculate(source(), "2026-09", now)
  assert.equal(r.base, 3000000)
  assert.equal(r.lateDeduction, 3000)
  assert.equal(r.overtimeBonus, 20000)
  assert.equal(r.absentDays, 2)
  assert.equal(r.absenceDeduction, 2000000)
  assert.equal(r.total, 1017000)
  assert.equal(r.blockedReason, null)
})
test("pending attendance and permission are not absence deductions; they block finalization", () => {
  const [r] = calculate(
    source({
      attendance: [log(1), log(2, { review_status: "PENDING" })],
      permissions: [
        {
          crew_id: "crew",
          start_date: "2026-09-03",
          end_date: "2026-09-03",
          status: "PENDING",
        },
      ],
    }),
    "2026-09",
    now,
  )
  assert.equal(r.absentDays, 0)
  assert.equal(r.pendingCount, 2)
  assert.match(r.blockedReason, /tinjauan/)
})
test("night shift is not absent before its following-day end; month cannot finalize prematurely", () => {
  const [r] = calculate(
    source({ schedules: [schedule(30, "22:00", "06:00")], attendance: [] }),
    "2026-09",
    new Date("2026-09-30T22:59:00Z"),
  )
  assert.equal(r.absentDays, 0)
  assert.match(r.blockedReason, /belum selesai/)
  const [done] = calculate(
    source({ schedules: [schedule(30, "22:00", "06:00")], attendance: [] }),
    "2026-09",
    new Date("2026-09-30T23:00:00Z"),
  )
  assert.equal(done.absentDays, 1)
  assert.equal(done.blockedReason, null)
})
test("no configured policy applies no arbitrary rates and cannot finalize", () => {
  const [r] = calculate(source({ policy: null }), "2026-09", now)
  assert.equal(r.total, person.base_salary)
  assert.equal(r.deduction, 0)
  assert.equal(r.overtimeBonus, 0)
  assert.match(r.blockedReason, /aturan/)
})
test("fee per event retains ended assignments, ignores automated late/overtime, and uses manual components", () => {
  const base = source({
    people: [{ ...person, crew_type: "CREW_EVENT", base_salary: 80000 }],
    assignments: [
      {
        id: "assign",
        crew_id: "crew",
        event_id: "event",
        event_name: "Event Selesai",
        event_date: "2026-09-01",
        end_date: "2026-09-02",
        event_status: "COMPLETED",
        status: "ENDED",
      },
    ],
    attendance: [
      log(1, { event_assignment_id: "assign", store_assignment_id: null }),
      log(2, { event_assignment_id: "assign", store_assignment_id: null }),
    ],
    adjustments: [
      {
        crew_id: "crew",
        scope_key: "event",
        rate_override: 150000,
        allowance: 25000,
        deduction: 10000,
        note: "Fee dan transport",
      },
    ],
  })
  const [r] = calculate(base, "2026-09", now)
  assert.equal(r.units, 2)
  assert.equal(r.total, 315000)
  assert.equal(r.lateDeduction, 0)
  assert.equal(r.overtimeBonus, 0)
  const [once] = calculate(
    { ...base, policy: { ...base.policy, event_basis: "PER_EVENT" } },
    "2026-09",
    now,
  )
  assert.equal(once.units, 1)
  assert.equal(once.total, 165000)
})
test("per-attendance wages do not double deduct absence and duplicate day is paid once", () => {
  const [r] = calculate(
    source({
      policy: {
        ...DEFAULT_POLICY,
        monthly_basis: "PER_ATTENDANCE",
        absence_mode: "FIXED",
        absence_rate: 10000,
      },
      attendance: [log(1), log(1, { id: "duplicate" })],
      people: [{ ...person, base_salary: 50000 }],
    }),
    "2026-09",
    now,
  )
  assert.equal(r.units, 1)
  assert.equal(r.total, 50000)
  assert.equal(r.absenceDeduction, 0)
})
test("deductions cap at gross, and final snapshots survive later source changes and crew deletion", () => {
  const base = source({
    adjustments: [
      {
        crew_id: "crew",
        scope_key: "MONTHLY",
        rate_override: null,
        allowance: 0,
        deduction: 9999999,
        note: "Manual",
      },
    ],
  })
  const [snapshot] = calculate(base, "2026-09", now)
  assert.equal(snapshot.total, 0)
  assert.equal(snapshot.cappedDeduction, snapshot.base + snapshot.overtimeBonus)
  const [final] = calculate(
    {
      people: [],
      slips: [
        {
          id: "slip",
          snapshot,
          status: "PAID",
          paid_date: "2026-10-01",
          payment_reference: "TRANSFER-01",
        },
      ],
    },
    "2026-09",
    now,
  )
  assert.equal(final.total, 0)
  assert.equal(final.status, "PAID")
  assert.equal(final.person.full_name, "Personel")
})
test("period validation rejects malformed and impossible months", () => {
  assert.equal(period("2026-09"), "2026-09-01")
  for (const value of ["2026-00", "2026-13", "2026-9", "2026-09-01", null, {}])
    assert.throws(() => period(value))
})
