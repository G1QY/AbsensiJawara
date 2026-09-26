const test=require('node:test'),assert=require('node:assert/strict');
const {shiftNumber,overlaps,canClockIn}=require('../src/utils/workShift');
const {scheduledEnd,overtimeMinutes}=require('../src/utils/attendanceTime');
const night={schedule_date:'2026-09-25',start_time:'22:00:00',end_time:'06:00:00'};
test('night shift retains start date across midnight and calculates overtime from next-day end',()=>{
  assert.equal(canClockIn(night,new Date('2026-09-25T21:45:00+07:00')),true);
  assert.equal(canClockIn(night,new Date('2026-09-26T00:30:00+07:00')),true);
  assert.equal(canClockIn(night,new Date('2026-09-26T06:00:00+07:00')),false);
  assert.equal(canClockIn({...night,start_time:'09:00:00',end_time:'18:00:00'},new Date('2026-09-26T00:30:00+07:00')),false);
  assert.equal(scheduledEnd(night).toISOString(),'2026-09-25T23:00:00.000Z');
  assert.equal(overtimeMinutes(new Date('2026-09-26T06:59:59+07:00'),scheduledEnd(night)),0);
  assert.equal(overtimeMinutes(new Date('2026-09-26T07:00:00+07:00'),scheduledEnd(night)),60);
});
test('all three shift labels are valid; adjacent overlap rejected but touching intervals allowed',()=>{
  for(const n of [1,2,3])assert.equal(shiftNumber(n),n);
  for(const n of [0,4,1.5,'night',null])assert.throws(()=>shiftNumber(n),/Shift/);
  assert.equal(overlaps(night,{schedule_date:'2026-09-26',start_time:'05:59',end_time:'14:00'}),true);
  assert.equal(overlaps(night,{schedule_date:'2026-09-26',start_time:'06:00',end_time:'14:00'}),false);
  assert.equal(overlaps(night,{...night,schedule_date:'2026-09-26'}),false);
});
