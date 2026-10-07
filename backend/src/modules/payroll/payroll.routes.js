const router = require("express").Router()
const db = require("../../config/supabaseClient")
const requireRole = require("../../middlewares/requireRole")
const { uuid, fail } = require("../crew/crew.validation")
const { period, workspace, check } = require("./payroll.service")
const { previewYear } = require('./payroll.year')
const employees = [
  "CREW_STORE",
  "CREW_EVENT",
  "HEAD_STORE",
  "ADMIN_STORE",
  "EVENT_MANAGER",
  "HEAD_OFFICE",
  "OFFICE_STAFF",
  "PRODUCTION_STAFF",
]
const amount = (value, nullable = false) => {
  if (nullable && value === null) return null
  if (!Number.isSafeInteger(value) || value < 0 || value > 9999999999)
    throw fail("Nominal harus rupiah bulat antara 0 dan 9.999.999.999.")
  return value
}
const option = (value, allowed) => {
  if (!allowed.includes(value))
    throw fail("Pilihan aturan payroll tidak valid.")
  return value
}
const note = (value, max = 1000) => {
  if (typeof value !== "string" || value.length > max)
    throw fail("Catatan payroll tidak valid.")
  return value.trim()
}
const policyInput = (p = {}) => ({
  monthly_basis: option(p.monthly_basis, ["MONTHLY", "PER_ATTENDANCE"]),
  late_rate: amount(p.late_rate),
  late_rounding: option(p.late_rounding, ["MINUTE", "HOUR_CEIL"]),
  overtime_rate: amount(p.overtime_rate),
  absence_mode: option(p.absence_mode, ["NONE", "SCHEDULED", "FIXED"]),
  absence_rate: amount(p.absence_rate),
  event_basis: option(p.event_basis, ["PER_ATTENDANCE", "PER_EVENT"]),
})
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store")
  next()
})
router.get("/me", requireRole(...employees), async (req, res, next) => {
  try {
    const data = await workspace(req.query.month, req.user.id)
    res.json(data)
  } catch (e) {
    next(e)
  }
})
router.get("/", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    res.json(await workspace(req.query.month))
  } catch (e) {
    next(e)
  }
})
// Event managers can read event-only payroll for events they already manage.
router.get(
  "/event/:id",
  requireRole("SUPER_ADMIN", "EVENT_MANAGER"),
  async (req, res, next) => {
    try {
      uuid(req.params.id)
      const { data, error } = await db
        .from("events")
        .select("*")
        .eq("id", req.params.id)
        .single()
      check(error)
      if (!data) throw fail("Event tidak ditemukan.", 404)
      const result = await workspace(
        (data.end_date || data.event_date).slice(0, 7),
      )
      res.json({
        ...result,
        rows: result.rows.filter((r) => r.scopeKey === req.params.id),
      })
    } catch (e) {
      next(e)
    }
  },
)
router.post("/preview", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const result = await workspace(req.body.month, null, policyInput(req.body.policy))
    if (result.revision !== req.body.revision) throw fail("Data payroll berubah. Muat ulang.", 409)
    res.json(result)
  } catch (e) { next(e) }
})
const annualInput = body => {
  const {year, fromMonth} = body
  if (!Number.isInteger(year) || year < 2000 || year > 2099 || !Number.isInteger(fromMonth) || fromMonth < 1 || fromMonth > 12) throw fail('Pilih tahun dan bulan mulai yang valid.')
  const p = body.policy || {}
  const day = value => {
    if (!Number.isInteger(value) || value < 1 || value > 31) throw fail('Tanggal harus angka 1 sampai 31.')
    return value
  }
  return {year, fromMonth, policy: {...policyInput(p), cutoff_day: day(p.cutoff_day), payment_day: day(p.payment_day), payment_month_offset: option(p.payment_month_offset, [0,1])}}
}
router.post('/year-preview', requireRole('SUPER_ADMIN'), async (req,res,next) => {
  try {
    const {year,fromMonth,policy} = annualInput(req.body)
    res.json(await previewYear(year,fromMonth,policy))
  } catch(e) { next(e) }
})
router.post('/year-policy', requireRole('SUPER_ADMIN'), async (req,res,next) => {
  try {
    const {year,fromMonth,policy} = annualInput(req.body)
    if (typeof req.body.revision !== 'string' || !/^[a-f0-9]{32}$/.test(req.body.revision)) throw fail('Buat pratinjau tahunan sebelum menyimpan.',409)
    const {data,error} = await db.rpc('set_payroll_year_policy',{p_actor:req.user.id,p_year:year,p_from_month:fromMonth,p_revision:req.body.revision,p_policy:policy})
    check(error)
    res.json({updated:data})
  } catch(e) { next(e) }
})
router.post("/batch-adjustments", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const month = req.body.month, p_period = period(month)
    const keys = req.body.keys, patch = req.body.patch || {}
    if (!Array.isArray(keys) || !keys.length || keys.length > 500 || new Set(keys).size !== keys.length || keys.some(k => typeof k !== 'string'))
      throw fail("Pilih 1 sampai 500 draft payroll yang berbeda.")
    const fields = ['rate_override', 'allowance', 'deduction'].filter(k => Object.hasOwn(patch,k))
    if (!fields.length) throw fail("Pilih komponen yang akan diubah.")
    const updates = Object.fromEntries(fields.map(k => [k, amount(patch[k],k === 'rate_override')]))
    const reason = note(patch.note)
    if (!reason) throw fail("Catatan penyesuaian wajib diisi.")
    const current = await workspace(month)
    if (current.revision !== req.body.revision) throw fail("Data payroll berubah. Muat ulang.",409)
    const rows = keys.map(key => {
      const row = current.rows.find(r => r.key === key)
      if (!row || row.status !== 'DRAFT') throw fail("Pilihan memuat slip yang sudah final atau tidak tersedia. Muat ulang.",409)
      return { ...row.adjustment, ...updates, note: reason, crewId: row.crewId, scopeKey: row.scopeKey }
    })
    if(req.body.preview===true) {
      const preview=await workspace(month,null,null,rows)
      if(preview.revision!==current.revision) throw fail("Data payroll berubah. Muat ulang.",409)
      return res.json({...preview,rows:preview.rows.filter(r=>keys.includes(r.key))})
    }
    const {data,error} = await db.rpc('mutate_payroll_adjustments', {p_actor:req.user.id,p_period,p_revision:current.revision,p_rows:rows})
    check(error)
    res.json({updated:data})
  } catch(e) { next(e) }
})
router.post("/:action", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const month = req.body.month,
      p_period = period(month),
      p_action = option(req.params.action.toUpperCase(), [
        "POLICY",
        "ADJUSTMENT",
        "FINALIZE",
        "PAID",
        "REOPEN",
      ])
    const revision = req.body.revision
    if (typeof revision !== "string" || !/^[a-f0-9]{32}$/.test(revision))
      throw fail("Muat ulang data payroll sebelum menyimpan.", 409)
    let payload
    if (p_action === "POLICY") {
      payload = policyInput(req.body.policy)
      const current = await workspace(month)
      if (current.policy.annual_year) throw fail('Aturan periode ini dikelola melalui Atur aturan tahunan.',409)
    } else if (["ADJUSTMENT", "FINALIZE"].includes(p_action)) {
      const crewId = uuid(req.body.crewId),
        scopeKey =
          req.body.scopeKey === "MONTHLY" ? "MONTHLY" : uuid(req.body.scopeKey)
      const current = await workspace(month)
      if (current.revision !== revision)
        throw fail("Data payroll berubah. Muat ulang.", 409)
      const row = current.rows.find(
        (r) => r.crewId === crewId && r.scopeKey === scopeKey,
      )
      if (!row) throw fail("Data payroll karyawan tidak ditemukan.", 404)
      if (row.status !== "DRAFT") throw fail("Payroll sudah final.", 409)
      if (p_action === "FINALIZE") {
        if (row.blockedReason) throw fail(row.blockedReason)
        payload = row
      } else {
        const a = req.body.adjustment || {}
        payload = {
          crewId,
          scopeKey,
          rate_override: amount(a.rate_override, true),
          allowance: amount(a.allowance),
          deduction: amount(a.deduction),
          note: note(a.note),
        }
        if (
          (payload.rate_override !== null ||
            payload.allowance ||
            payload.deduction) &&
          !payload.note
        )
          throw fail("Catatan penyesuaian wajib diisi.")
      }
    } else {
      payload = { id: uuid(req.body.id) }
      if (p_action === "REOPEN") {
        payload.note = note(req.body.note)
        if (payload.note.length < 5)
          throw fail("Isi alasan membuka kembali payroll.")
      } else {
        payload.payment_reference = note(req.body.payment_reference, 200)
        payload.paid_date = req.body.paid_date
        if (
          payload.payment_reference.length < 3 ||
          typeof payload.paid_date !== "string" ||
          !/^20\d{2}-\d{2}-\d{2}$/.test(payload.paid_date) ||
          !Number.isFinite(Date.parse(payload.paid_date)) ||
          new Date(payload.paid_date).toISOString().slice(0, 10) !==
            payload.paid_date
        )
          throw fail("Isi tanggal dan referensi pembayaran yang valid.")
      }
    }
    const { data, error } = await db.rpc("mutate_payroll", {
      p_actor: req.user.id,
      p_action,
      p_period,
      p_revision: revision,
      p_data: payload,
    })
    check(error)
    res.json({ id: data, message: "Payroll tersimpan." })
  } catch (e) {
    next(e)
  }
})
module.exports = router
