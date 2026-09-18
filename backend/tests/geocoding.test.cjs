const test = require('node:test'), assert = require('node:assert/strict');
const { createGeocoder, coordinate } = require('../src/modules/locations/geocoding.service');
const row = { display_name: 'Jalan Braga, Bandung', lat: '-6.917', lon: '107.609', address: { road: 'Jalan Braga' } };
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const create = opts => createGeocoder({ getRedis: () => null, ...opts });
test('search validates input, filters Indonesia and identifies application; no key required', async () => {
  let url, options;
  const service = create({ fetcher: async (u, o) => { url = u; options = o; return response([row]); } });
  assert.throws(() => service.search('ab'), { status: 400 });
  assert.throws(() => service.search({}), { status: 400 });
  const results = await service.search('  Jalan  Braga, Bandung  ');
  assert.equal(url.searchParams.get('q'), 'Jalan Braga, Bandung');
  assert.equal(url.searchParams.get('countrycodes'), 'id');
  assert.match(options.headers['User-Agent'], /JawaraAttendance/);
  assert.equal(results[0].street, 'Jalan Braga');
  assert.equal(results[0].latitude, -6.917);
});
test('reverse validates coordinates and preserves zero; concurrent same point uses one lookup', async () => {
  let calls = 0;
  const service = create({ fetcher: async u => { calls++; assert.equal(u.searchParams.get('lat'), '0.00000'); return response(row); } });
  for (const value of [null, undefined, '', false, [], 'NaN', 91]) assert.throws(() => coordinate(value, 90), { status: 400 });
  const results = await Promise.all([service.reverse(0, 107), service.reverse(0, 107), service.reverse(0, 107)]);
  await service.reverse(0, 107);
  assert.equal(calls, 1); assert.equal(results[0][0].address, row.display_name);
});
test('search and reverse serialize requests with at least 1.1 seconds separation', async () => {
  let clock = 0; const starts = [];
  const service = create({ now: () => clock, wait: async ms => { clock += ms; }, fetcher: async u => { starts.push(clock); return response(u.pathname === '/search' ? [row] : row); } });
  await service.search('Braga Bandung'); await service.reverse(-6.917, 107.609); await service.search('Jakarta Blok M');
  assert.ok(starts[1] - starts[0] >= 1100); assert.ok(starts[2] - starts[1] >= 1100);
});
test('queue expires without overloading provider, and failures release the lock', async () => {
  let clock = 0, calls = 0;
  const service = create({ queueMs: 0, now: () => clock, fetcher: async () => { calls++; throw new Error('offline'); } });
  await assert.rejects(service.search('Braga'), { status: 503 });
  await assert.rejects(service.search('Bandung'), { status: 429 });
  clock += 1200;
  await assert.rejects(service.search('Bandung'), { status: 503 }); assert.equal(calls, 2);
});
test('provider denial cools down without retry storms; invalid rows and no match are handled', async () => {
  let calls = 0;
  const limited = create({ fetcher: async () => { calls++; return response({}, 429); } });
  await assert.rejects(limited.reverse(0, 0), { status: 429 });
  await assert.rejects(limited.reverse(1, 1), { status: 429 }); assert.equal(calls, 1);
  assert.deepEqual(await create({ fetcher: async () => response([{ ...row, lat: null }, { ...row, lon: 500 }]) }).search('Bandung'), []);
  assert.deepEqual(await create({ fetcher: async () => response({ error: 'Unable to geocode' }) }).reverse(0, 0), []);
  await assert.rejects(create({ fetcher: async () => response(null) }).reverse(0, 0), { status: 503 });
});
test('Redis cache avoids provider calls and shared store failure fails closed', async () => {
  let calls = 0;
  const service = createGeocoder({ getRedis: () => ({ isReady: true, get: async () => JSON.stringify([{ address: 'Cached street' }]) }), fetcher: async () => { calls++; } });
  assert.equal((await service.reverse(0, 0))[0].address, 'Cached street'); assert.equal(calls, 0);
  await assert.rejects(createGeocoder({ getRedis: () => ({ get: async () => { throw new Error('redis down'); } }) }).reverse(0, 0), { status: 503 });
});
test('two server instances share provider spacing and cached results through Redis', async () => {
  const values = new Map();
  const redis = {
    isReady: true,
    async get(key) { const entry=values.get(key); if(!entry || entry.until<Date.now())return null; return entry.value; },
    async set(key,value,options={}) { if(options.NX && await this.get(key))return null; values.set(key,{value,until:Date.now()+(options.PX || options.EX*1000 || 60000)});return 'OK'; },
    async eval(script,{keys,arguments:args}) { if(await this.get(keys[0])===args[0]){values.get(keys[0]).until=Date.now()+1100;return 1;}return 0; },
  };
  const starts=[];
  const fetcher=async u=>{starts.push(Date.now());return response(u.pathname==='/search'?[row]:row);};
  const first=createGeocoder({getRedis:()=>redis,fetcher}),second=createGeocoder({getRedis:()=>redis,fetcher});
  await first.search('Jalan Braga');
  await second.reverse(-6.917,107.609);
  await second.search('Jalan Braga');
  assert.equal(starts.length,2);assert.ok(starts[1]-starts[0]>=1100);
});
test('guest route exposes reverse only, admin search requires an allowed role, missing coordinates return 400', async () => {
  const express=require('express');const routes=require('../src/modules/locations/locations.routes');
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.role=req.get('x-test-role');next();});
  app.use('/guest',routes.guest);app.use('/admin',routes.admin);
  app.use((err,req,res,next)=>res.status(err.status||500).json({message:err.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const post=(path,body,role)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(role?{'x-test-role':role}:{})},body:JSON.stringify(body)});
    assert.equal((await post('/guest/search',{text:'Bandung'})).status,404);
    assert.equal((await post('/guest/reverse',{})).status,400);
    assert.equal((await post('/admin/search',{text:'Bandung'},'CREW_EVENT')).status,403);
    assert.equal((await post('/admin/search',{text:'ab'},'SUPER_ADMIN')).status,400);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
