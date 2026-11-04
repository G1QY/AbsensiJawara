const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const calls = [], reads = [];
const db = {
  async rpc(name, args) { calls.push({name, args}); return {data:id(5), error:null}; },
  from(table) {
    const filters = [];
    const q = {
      select() { return q; },
      eq(key, value) { filters.push([key, value]); return q; },
      order() { return q; },
      limit() { reads.push({table, filters}); return Promise.resolve({data:[], error:null}); },
      async maybeSingle() { return {data:{id:id(2)}, error:null}; },
    };
    return q;
  },
};
const modulePath = require.resolve('../src/config/supabaseClient');
require.cache[modulePath] = {id:modulePath, filename:modulePath, loaded:true, exports:db};

test('permission routes scope crew reads and derive actor/status from authenticated requests', async () => {
  const app = express();
  app.use(express.json(), (req, res, next) => {
    req.role = req.headers['x-test-role'] || 'CREW_STORE'; req.user = {id:id(1)}; next();
  });
  app.use(require('../src/security/headStore').headStoreBoundary, require('../src/security/eventManager').eventManagerBoundary);
  app.use('/permissions', require('../src/modules/attendance/permissions.routes'));
  app.use((error, req, res, next) => res.status(error.status || 500).json({message:error.message}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/permissions';
  const json = {'Content-Type':'application/json'};
  const admin = {...json, 'x-test-role':'SUPER_ADMIN'};
  try {
    assert.equal((await fetch(base + '?crewId=' + id(99))).status, 200);
    assert.deepEqual(reads.at(-1).filters, [['crew_id', id(2)]]);
    assert.equal((await fetch(base + '?status=PENDING&crewId=' + id(99), {headers:admin})).status, 200);
    assert.deepEqual(reads.at(-1).filters, [['crew_id', id(99)], ['status', 'PENDING']]);
    assert.equal((await fetch(base + '?status=INVALID', {headers:admin})).status, 422);

    const body = {startDate:'2026-12-25',endDate:'2026-12-25',type:'SICK',reason:'Perlu istirahat',crewId:id(99),p_actor:id(99),status:'APPROVED'};
    const submitted = await fetch(base, {method:'POST', headers:json, body:JSON.stringify(body)});
    assert.equal(submitted.status, 201);
    assert.equal((await submitted.json()).status, 'PENDING');
    assert.equal(calls.at(-1).args.p_actor, id(1));
    assert.equal(calls.at(-1).args.p_type, 'SICK');
    assert.equal(calls.at(-1).args.crewId, undefined);
    for (const patch of [{type:'DAY_OFF'}, {startDate:'2026-02-30'}, {startDate:'2026-01-01',endDate:'2026-02-02'}, {reason:' '}]) {
      assert.equal((await fetch(base, {method:'POST', headers:json, body:JSON.stringify({...body,...patch})})).status, 422);
    }

    const decision = {decision:'APPROVED',note:''};
    assert.equal((await fetch(base + '/' + id(5), {method:'PATCH', headers:json, body:JSON.stringify(decision)})).status, 403);
    for (const role of ['CREW_EVENT','HEAD_STORE','ADMIN_STORE','HEAD_OFFICE','OFFICE_STAFF','PRODUCTION_STAFF','EVENT_MANAGER']) {
      const headers = {...json,'x-test-role':role};
      assert.equal((await fetch(base + '?crewId=' + id(99), {headers})).status, 200, role);
      assert.deepEqual(reads.at(-1).filters, [['crew_id',id(2)]]);
      assert.equal((await fetch(base, {method:'POST',headers,body:JSON.stringify(body)})).status, 201, role);
      assert.equal(calls.at(-1).args.p_actor,id(1));
      assert.equal((await fetch(base + '/' + id(5), {method:'PATCH',headers,body:JSON.stringify(decision)})).status, 403, role);
    }
    assert.equal((await fetch(base + '/' + id(5), {method:'PATCH', headers:admin, body:JSON.stringify({decision:'REJECTED'})})).status, 422);
    assert.equal((await fetch(base + '/' + id(5), {method:'PATCH', headers:admin, body:JSON.stringify(decision)})).status, 200);
    assert.equal(calls.at(-1).name, 'review_crew_permission');
    assert.deepEqual(calls.at(-1).args, {p_actor:id(1),p_id:id(5),p_decision:'APPROVED',p_note:''});
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
