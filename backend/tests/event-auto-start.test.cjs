const test=require('node:test'),assert=require('node:assert/strict');
const {shouldStart}=require('../src/services/eventAutoStart');
test('scheduled starts exactly at WIB start; other states remain unchanged',()=>{
 const event={status:'SCHEDULED',event_date:'2027-01-01',start_time:'09:00:00'};
 assert.equal(shouldStart(event,Date.parse('2027-01-01T01:59:59Z')),false);
 assert.equal(shouldStart(event,Date.parse('2027-01-01T02:00:00Z')),true);
 for(const status of ['DRAFT','CANCELLED','COMPLETED','ONGOING'])assert.equal(shouldStart({...event,status},Date.parse('2027-01-02')),false);
 assert.equal(shouldStart({...event,start_time:null}),false);
});
