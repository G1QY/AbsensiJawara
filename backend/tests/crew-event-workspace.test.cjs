const test = require('node:test');
const assert = require('node:assert/strict');
const userId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const saved = [];
let workflow = null;

const db = { from(table) {
  const filters = {};
  let payload;
  const q = {
    select() { return q; }, eq(key, value) { filters[key] = value; return q; }, in() { return q; }, order() { return q; },
    insert(value) { payload = value; saved.push(value); workflow = value; return q; },
    update(value) { payload = value; saved.push(value); workflow = value; return q; },
    async maybeSingle() {
      if (table === 'crew') return { data: { id: 'crew-1', employee_code: 'BDG-EVT-1', base_salary: 1000000, user: { full_name: 'Crew Uji' } }, error: null };
      if (table === 'event_assignments') return { data: filters.event_id === eventId ? { id: 'assignment-1', event_id: eventId, status: 'ACTIVE' } : null, error: null };
      if (table === 'event_workflows') return { data: workflow, error: null };
      return { data: null, error: null };
    },
    async single() { return { data: payload, error: null }; },
    then(resolve, reject) {
      let data = [];
      if (table === 'event_assignments') data = [{ id: 'assignment-1', position: 'PIC', status: 'ACTIVE', event: { id: eventId, event_code: 'BDG-SMA1', event_name: 'SMA 1 Bandung', event_date: '2026-09-01', status: 'ONGOING', event_locations: [{ address: 'Bandung' }] }, event_schedules: [] }];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return q;
} };
const dbPath = require.resolve('../src/config/supabaseClient');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };

test('Crew Event hanya dapat membuka dan menyimpan workflow event penugasannya', async () => {
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use((req,res,next)=>{ req.user={id:userId}; req.role=req.headers['x-role']||'CREW_EVENT'; next(); });
  app.use('/crew-event', require('../src/modules/events/crewEventWorkspace.routes'));
  app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}/crew-event`;
  try {
    const workspace = await fetch(base+'/workspace');
    assert.equal(workspace.status, 200);
    assert.equal((await workspace.json()).assignments[0].event.event_code, 'BDG-SMA1');
    const ok = await fetch(base+`/events/${eventId}/workflow`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:{omset_nominal:250000},expectedUpdatedAt:null,currentStep:1,maxReached:1}) });
    assert.equal(ok.status, 200, await ok.clone().text());
    assert.equal(saved[0].updated_by, userId);
    const merged = await fetch(base+`/events/${eventId}/workflow`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:{tes_print_before_photo:'event-workflows/'+eventId+'/photo.jpg'},expectedUpdatedAt:workflow.updated_at,currentStep:1,maxReached:1}) });
    assert.equal(merged.status, 200, await merged.clone().text());
    const mergedBody = await merged.json();
    assert.equal(mergedBody.data.omset_nominal, 250000);
    assert.equal(mergedBody.data.tes_print_before_photo, 'event-workflows/'+eventId+'/photo.jpg');
    const denied = await fetch(base+'/events/00000000-0000-4000-8000-000000000099/workflow');
    assert.equal(denied.status, 403);
    const wrongRole = await fetch(base+'/workspace', {headers:{'x-role':'ADMIN_STORE'}});
    assert.equal(wrongRole.status, 403);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
