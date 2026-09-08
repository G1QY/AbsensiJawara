const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('workflow migration blocks direct crew writes and validates progress',()=>{
  const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20260901090000_secure_event_workflows.sql'),'utf8');
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all[\s\S]*anon, authenticated/i);
  assert.match(sql,/max_reached >= current_step/i);
});
