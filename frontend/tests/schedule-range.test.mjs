import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import vm from 'node:vm';
const m=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../src/lib/scheduleRange.ts',import.meta.url),'utf8')));await m.link(()=>{});await m.evaluate();
test('four years processed as consecutive months including leap day',()=>{const rows=[...m.namespace.scheduleMonths('2026-09-07','2030-09-07')];assert.equal(rows.length,49);assert.equal(rows[0].startDate,'2026-09-07');assert.equal(rows.at(-1).endDate,'2030-09-07');assert.equal(rows.find(x=>x.startDate==='2028-02-01').endDate,'2028-02-29');for(let i=1;i<rows.length;i++)assert.equal(Date.parse(rows[i].startDate)-Date.parse(rows[i-1].endDate),86400000);});
test('range summary counts new/updated/locked and time-off skips across months, including older API responses',async()=>{
 let call=0;
 const result=await m.namespace.submitScheduleRange(async()=>++call===1?{created:3,updated:1,skippedTimeOff:2,lockedByAttendance:1,skippedHoliday:0,skippedExisting:0,skippedEvent:0,skippedDay:0}:{created:4,inserted:3,updated:1,skippedTimeOff:1,skippedHoliday:0,skippedExisting:0,skippedEvent:0,skippedDay:0},{startDate:'2026-09-30',endDate:'2026-10-02'},()=>{});
 assert.equal(result.created,7);assert.equal(result.inserted,5);assert.equal(result.updated,2);assert.equal(result.skippedTimeOff,3);assert.equal(result.lockedByAttendance,1);
});
