const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
function load(file){const ctx={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.exports;}
const {readDeviceLocation}=load('lib/deviceLocation.ts');
const {gpsPoint,gpsLink,fromGuest,fromRegistered,recap}=load('pages/admin/attendanceData.ts');
test('each attendance measurement requests fresh high accuracy GPS, including zero coordinates',async()=>{
 let calls=0;
 const device={getCurrentPosition(success,error,options){calls++;assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);success({coords:{latitude:0,longitude:107,accuracy:4.1}});}};
 const result=await readDeviceLocation(device); await readDeviceLocation(device);
 assert.equal(calls,2);assert.equal(result.latitude,0);assert.equal(result.accuracy,5);
});
test('denied or invalid GPS does not resolve a fake or cached location',async()=>{
 await assert.rejects(readDeviceLocation({getCurrentPosition(ok,no){no({code:1});}}),/Izin lokasi/);
 await assert.rejects(readDeviceLocation({getCurrentPosition(ok){ok({coords:{latitude:999,longitude:107,accuracy:10}});}}),/tidak valid/);
});
test('missing coordinates stay missing; zero coordinates remain valid map links',()=>{
 assert.equal(gpsPoint(null,null),null);assert.equal(gpsPoint('',''),null);assert.equal(gpsPoint(91,0),null);
 assert.match(gpsLink(gpsPoint(0,0)),/query=0,0$/);
});
test('guest clock-out and registered in/out export stored GPS separately without addresses',()=>{
 const guest=fromGuest({id:'g',clock_type:'OUT',occurred_at:'2026-09-12T10:00:00Z',crew_type:'CREW_STORE',latitude:0,longitude:107,accuracy:15,location_name:'HQ'});
 assert.equal(guest.inGPS,null);assert.equal(guest.outGPS.latitude,0);
 const row=fromRegistered({id:'r',status:'PRESENT',check_in_lat:-6,check_in_lng:107,check_out_lat:-7,check_out_lng:108});
 const sheet=recap([guest,row]);assert.equal(sheet[0].length,sheet[1].length);
 assert.equal(sheet[1][sheet[0].indexOf('Latitude Masuk')],null);
 assert.equal(sheet[1][sheet[0].indexOf('Latitude Pulang')],0);
 assert.equal(sheet[2][sheet[0].indexOf('Latitude Masuk')],-6);
 assert.equal(sheet[2][sheet[0].indexOf('Latitude Pulang')],-7);
 assert.equal(sheet[2][sheet[0].indexOf('Akurasi Masuk (m)')],null);
});
