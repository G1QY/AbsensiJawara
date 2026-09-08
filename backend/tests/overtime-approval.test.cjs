const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('overtime migration requires schedule approval, admin review, and crew notification',()=>{
 const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20260901021500_crew_overtime_approval_notifications.sql'),'utf8');
 assert.match(sql,/store_schedules[\s\S]*overtime_preapproved/);
 assert.match(sql,/event_schedules[\s\S]*overtime_preapproved/);
 assert.match(sql,/previous<>'PENDING'/);
 assert.match(sql,/insert into public\.notifications/);
 assert.match(sql,/OVERTIME_REVIEW/);
});
