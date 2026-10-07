const db = require('../../config/supabaseClient')
const { fail } = require('../crew/crew.validation')
const { check, calculate, DEFAULT_POLICY } = require('./payroll.service')

async function previewYear(year, fromMonth, policy) {
  const { data, error } = await db.rpc('payroll_year_workspace', { p_year: year, p_from_month: fromMonth, p_policy: policy })
  check(error)
  if (!data?.months?.length || !data.revision) throw fail('Pratinjau tahunan tidak tersedia.', 503)
  const issues = [], now = new Date()
  let basisChanged = false, datesChanged = false
  const months = data.months.map(({month, source, previewSource}) => {
    const before = calculate(source, month, now), after = calculate(previewSource, month, now)
    const beforeCalendar = source.calendar, afterCalendar = previewSource.calendar
    const boundaryChanged = beforeCalendar.startDate !== afterCalendar.startDate || beforeCalendar.endDate !== afterCalendar.endDate
    const affected = month.startsWith(String(year))
    const previous = source.policy || DEFAULT_POLICY
    if (affected && (previous.monthly_basis !== policy.monthly_basis || previous.event_basis !== policy.event_basis)) basisChanged = true
    if (boundaryChanged) datesChanged = true
    if (boundaryChanged && (source.slips || []).some(s => s.scope_key === 'MONTHLY')) issues.push(`${month}: batas periode terkunci oleh slip final/dibayar. Pilih bulan mulai setelah periode tersebut.`)
    if (affected && afterCalendar.paymentDate <= afterCalendar.endDate) issues.push(`${month}: tanggal bayar harus setelah akhir periode. Majukan batas periode atau pilih pembayaran bulan berikutnya.`)
    const draftTotal = rows => rows.filter(r => r.status === 'DRAFT').reduce((sum, r) => sum + r.total, 0)
    return {month, affected, beforeCalendar, afterCalendar, beforeTotal: draftTotal(before), afterTotal: draftTotal(after), drafts: after.filter(r => r.status === 'DRAFT').length, locked: after.filter(r => r.status !== 'DRAFT').length}
  })
  return {year, fromMonth, revision: data.revision, months, issues, basisChanged, datesChanged}
}
module.exports = { previewYear }
