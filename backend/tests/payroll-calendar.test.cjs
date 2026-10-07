const test = require('node:test'), assert = require('node:assert/strict')
const client = require.resolve('../src/config/supabaseClient')
require.cache[client] = {id:client,filename:client,loaded:true,exports:{}}
const {calendar} = require('../src/modules/payroll/payroll.calendar')
const {calculate,DEFAULT_POLICY} = require('../src/modules/payroll/payroll.service')
test('cutoff and payday clamp in leap/non-leap months, preserve year boundaries and transition continuity', () => {
  const rule={cutoff_day:25,payment_day:30,payment_month_offset:0}
  assert.deepEqual(calendar('2028-02',rule,rule),{startDate:'2028-01-26',endDate:'2028-02-25',paymentDate:'2028-02-29'})
  assert.equal(calendar('2027-02',rule,rule).paymentDate,'2027-02-28')
  assert.deepEqual(calendar('2026-01',rule),{startDate:'2026-01-01',endDate:'2026-01-25',paymentDate:'2026-01-30'})
  assert.equal(calendar('2027-01',{},rule).startDate,'2026-12-26')
  assert.deepEqual(calendar('2026-12'),{startDate:'2026-12-01',endDate:'2026-12-31',paymentDate:'2027-01-01'})
  const old=calendar('2026-09'), transition=calendar('2026-10',rule), next=calendar('2026-11',rule,rule)
  assert.equal(Date.parse(transition.startDate)-Date.parse(old.endDate),86400000)
  assert.equal(Date.parse(next.startDate)-Date.parse(transition.endDate),86400000)
})
test('custom period counts preceding-month attendance once, excludes following period, and can finalize before calendar month-end', () => {
  const policy={...DEFAULT_POLICY,monthly_basis:'PER_ATTENDANCE',cutoff_day:25,payment_day:30,payment_month_offset:0}
  const source={policy,calendar:calendar('2026-10',policy,policy),people:[{id:'c',user_id:'u',full_name:'Crew',status:'ACTIVE',crew_type:'CREW_STORE',base_salary:100000,join_date:'2020-01-01'}],
    attendance:['2026-09-25','2026-09-26','2026-10-25','2026-10-26'].map(date=>({crew_id:'c',store_assignment_id:'s',attendance_date:date,check_in:date+'T02:00:00Z',check_out:date+'T10:00:00Z',status:'PRESENT',review_status:'APPROVED'}))}
  const [before]=calculate(source,'2026-10',new Date('2026-10-25T16:59:59Z'))
  assert.equal(before.units,2);assert.equal(before.total,200000);assert.match(before.blockedReason,/2026-10-25/)
  const [ready]=calculate(source,'2026-10',new Date('2026-10-25T17:00:00Z'))
  assert.equal(ready.blockedReason,null);assert.equal(ready.periodStart,'2026-09-26');assert.equal(ready.paymentDate,'2026-10-30')
  source.schedules=[{crew_id:'c',schedule_date:'2026-10-25',start_time:'22:00',end_time:'06:00'}]
  assert.match(calculate(source,'2026-10',new Date('2026-10-25T22:59:00Z'))[0].blockedReason,/semua shift selesai/)
  assert.equal(calculate(source,'2026-10',new Date('2026-10-25T23:00:00Z'))[0].blockedReason,null)
})
