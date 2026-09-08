const test = require("node:test")
const assert = require("node:assert/strict")
const {
  validateCrew,
  validatePassword,
  uuid,
} = require("../src/modules/crew/crew.validation")
const valid = {
  fullName: "Crew Baru",
  employeeNumber: 100,
  crewType: "CREW_EVENT",
  branchId: "00000000-0000-4000-8000-000000000001",
  email: "crew@example.test",
  password: "test-password",
}
test("new crew defaults salary to zero and excludes password/email/privilege fields from transaction", () => {
  const row = validateCrew(
    { ...valid, role: "SUPER_ADMIN", user_id: "attacker" },
    true,
  )
  assert.equal(row.baseSalary, 0)
  assert.equal(row.password, undefined)
  assert.equal(row.email, undefined)
  assert.equal(row.role, undefined)
  assert.equal(row.user_id, undefined)
})
test("salary accepts zero and rejects negative, decimal, infinite, text and excessive amounts", () => {
  assert.equal(validateCrew({ baseSalary: 0 }).baseSalary, 0)
  for (const value of [-1, 1.5, Infinity, "200", 10000000000])
    assert.throws(() => validateCrew({ baseSalary: value }))
})
test("create validates email, password, type and employee code or number", () => {
  for (const patch of [
    { email: "invalid" },
    { password: "short" },
    { crewType: "SUPER_ADMIN" },
    { fullName: "" },
    { employeeNumber: 0 },
    { employeeNumber: 1.5 },
    { employeeCode: "kode dengan spasi" },
  ])
    assert.throws(() => validateCrew({ ...valid, ...patch }, true))
})
test("employee code is editable, normalized, and event assignment is rejected in Kelola Crew", () => {
  assert.equal(validateCrew({ employeeCode: "bdg-sma1-7" }).employeeCode, "BDG-SMA1-7")
  assert.equal(validateCrew({ ...valid, employeeNumber: undefined, employeeCode: "BDG-SMA1-1" }, true).employeeCode, "BDG-SMA1-1")
  assert.throws(() => validateCrew({ crewType: "CREW_EVENT", assignTo: "00000000-0000-4000-8000-000000000001" }))
})
test("updates preserve blank phone and nullable branch, but reject login-field overwrite", () => {
  assert.deepEqual(validateCrew({ phoneNumber: "", branchId: null }), {
    phoneNumber: "",
    branchId: null,
  })
  for (const field of ["email", "password", "newPassword"])
    assert.throws(() => validateCrew({ [field]: "secret" }))
})
test("password and ids are validated", () => {
  assert.throws(() => validatePassword(12345678))
  assert.throws(() => validatePassword("x".repeat(129)))
  assert.throws(() => uuid("../users"))
  assert.equal(
    uuid("00000000-0000-4000-8000-000000000001"),
    "00000000-0000-4000-8000-000000000001",
  )
})
