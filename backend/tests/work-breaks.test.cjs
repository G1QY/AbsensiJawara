const test=require('node:test'),assert=require('node:assert/strict');
const {breakFields,breakWindow}=require('../src/utils/workBreak');
test('break ranges fit daytime and all midnight variants',()=>{
  for(const [s,e,b,c] of [['07:00','12:00','09:00','10:00'],['15:00','19:00','16:00','17:00'],['22:00','06:00','23:30','00:30'],['22:00','06:00','02:00','03:00']]) assert.equal(breakFields(s,e,b,c).break_start_time,b);
  for(const [b,c] of [['','10:00'],['07:00','08:00'],['09:00','09:00'],['11:00','12:00'],['10:00','09:00'],['13:00','14:00'],['09:60','10:00']])assert.throws(()=>breakFields('07:00','12:00',b,c));
  assert.deepEqual(breakFields('07:00','12:00','',''),{break_start_time:null,break_end_time:null});
  const window=breakWindow({schedule_date:'2026-10-23',start_time:'22:00:00',end_time:'06:00:00',break_start_time:'02:00:00',break_end_time:'03:00:00'});
  assert.equal(window.start.toISOString(),'2026-10-23T19:00:00.000Z');assert.equal(window.end.toISOString(),'2026-10-23T20:00:00.000Z');assert.equal(window.shiftEnd.toISOString(),'2026-10-23T23:00:00.000Z');
});
