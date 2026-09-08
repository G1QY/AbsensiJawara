const fail = (message, status = 422) =>
  Object.assign(new Error(message), { status })
function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw fail("ID tidak valid.")
  return value
}
function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128)
    throw fail("Password harus 8–128 karakter.")
}
function validateCrew(body, creating = false) {
  const out = {}
  for (const [key, min, max] of [
    ["fullName", 2, 150],
    ["phoneNumber", 0, 30],
  ]) {
    if (
      body[key] !== undefined ||
      (creating && key === "fullName")
    ) {
      if (
        typeof body[key] !== "string" ||
        body[key].trim().length < min ||
        body[key].trim().length > max
      )
        throw fail(`${key} harus ${min}–${max} karakter.`)
      out[key] = body[key].trim()
    }
  }
  if (body.employeeCode !== undefined) {
    if (
      typeof body.employeeCode !== "string" ||
      body.employeeCode.trim().length < 5 ||
      body.employeeCode.trim().length > 30 ||
      !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/.test(body.employeeCode.trim())
    )
      throw fail("Kode karyawan harus 5–30 karakter dan hanya memakai huruf, angka, atau tanda hubung.")
    out.employeeCode = body.employeeCode.trim().toUpperCase()
  }
  if (creating && body.employeeCode === undefined) {
    if (!Number.isInteger(body.employeeNumber) || body.employeeNumber < 1 || body.employeeNumber > 999999)
      throw fail("Nomor karyawan harus angka 1 sampai 999999.")
    out.employeeNumber = body.employeeNumber
  }
  if (body.crewType !== undefined || creating) {
    if (!["CREW_EVENT", "CREW_STORE"].includes(body.crewType))
      throw fail("Jenis crew tidak valid.")
    out.crewType = body.crewType
  }
  if (body.status !== undefined) {
    if (!["ACTIVE", "INACTIVE"].includes(body.status))
      throw fail("Status tidak valid.")
    out.status = body.status
  }
  if (body.baseSalary !== undefined || creating) {
    const value = body.baseSalary ?? 0
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 9999999999 ||
      !Number.isInteger(value)
    )
      throw fail("Gaji harus angka rupiah bulat antara 0 dan 9.999.999.999.")
    out.baseSalary = value
  }
  for (const key of ["branchId", "assignTo", "codeSourceId"])
    if (body[key] !== undefined)
      out[key] = body[key] === null || body[key] === "" ? null : uuid(body[key])
  if (out.crewType === "CREW_EVENT" && out.assignTo)
    throw fail("Penugasan Crew Event hanya dilakukan melalui Kelola Event.")
  if (creating) {
    if (
      typeof body.email !== "string" ||
      body.email.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    )
      throw fail("Email tidak valid.")
    validatePassword(body.password)
  } else if (
    body.password !== undefined ||
    body.email !== undefined ||
    body.newPassword !== undefined
  )
    throw fail("Gunakan fitur khusus perubahan email atau password.")
  return out
}
module.exports = { fail, uuid, validateCrew, validatePassword }
