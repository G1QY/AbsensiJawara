const test=require('node:test'),assert=require('node:assert/strict');
const dbPath=require.resolve('../../src/config/supabaseClient');let calls=0;
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{from(){calls++;throw Error('DB must not be reached');}}};
const factory=require('../../src/utils/crudFactory');
function response(){return {status(s){this.code=s;return this},json(v){this.body=v;return this}};}
test('legacy lists cannot expose all employees to a crew account',async()=>{const res=response();await factory('events').list({role:'CREW_EVENT'},res,e=>{throw e});assert.equal(res.code,403);assert.equal(calls,0);});
test('legacy raw writes disabled even for super admin',async()=>{const res=response();await factory('events').create({role:'SUPER_ADMIN',body:{id:'forged',status:'COMPLETED'}},res,e=>{throw e});assert.equal(res.code,405);assert.equal(calls,0);});
