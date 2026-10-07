// Dates are calendar dates in WIB, not server-local timestamps.
const iso = date => date.toISOString().slice(0, 10)
function dayInMonth(year, month, day) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return iso(new Date(Date.UTC(year, month - 1, Math.min(day, last))))
}
function calendar(month, policy = {}, previousPolicy = {}) {
  const [year, number] = month.split('-').map(Number)
  const previousEnd = dayInMonth(year, number - 1, previousPolicy.cutoff_day ?? 31)
  return {
    startDate: iso(new Date(Date.parse(previousEnd + 'T00:00:00Z') + 86400000)),
    endDate: dayInMonth(year, number, policy.cutoff_day ?? 31),
    paymentDate: dayInMonth(year, number + (policy.payment_month_offset ?? 1), policy.payment_day ?? 1),
  }
}
module.exports = { calendar }
