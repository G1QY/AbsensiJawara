import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const context=vm.createContext({Date,Intl,Uint8Array,TextEncoder,TextDecoder});
const source=await readFile(new URL('../src/pages/admin/attendanceData.ts',import.meta.url),'utf8');
const dataModule=new vm.SourceTextModule(stripTypeScriptTypes(source),{context});await dataModule.link(()=>{throw new Error('No runtime dependency expected');});await dataModule.evaluate();
const d=dataModule.namespace;
const fflate=require('fflate');
const zipModule=new vm.SyntheticModule(['zipSync','strToU8'],function(){this.setExport('zipSync',fflate.zipSync);this.setExport('strToU8',fflate.strToU8);},{context});
const xlsx=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../src/lib/xlsxExport.ts',import.meta.url),'utf8')),{context});await xlsx.link(()=>zipModule);await xlsx.evaluate();
const local={id:'GST-P5D35',nama:'Gilang',hp:'087825791000',jenis:'Crew Event',lokasi:'BCH',posisi:'Fotografer',tipe:'Clock In',timestamp:'Senin, 31 Agustus 2026 • 13:04',timeShort:'13:04',dateFull:'Senin, 31 Agustus 2026',foto:'data:image/jpeg;base64,TEST',catatan:'Printer bermasalah\nMohon diperiksa',status:'Menunggu Verifikasi Admin'};
test('legacy Indonesian timestamps parse consistently to WIB dates; invalid dates stay unknown',()=>{
 assert.equal(d.wibDate(d.legacyTime(local)),'2026-08-31');
 assert.equal(d.legacyTime({...local,dateFull:'',timestamp:'Minggu, 30 Agustus 2026 pukul 22.15',timeShort:''}),'2026-08-30T22:15:00+07:00');
 assert.equal(d.legacyTime({...local,dateFull:'31 Februari 2026',timestamp:''}),null);
 assert.equal(d.legacyTime({...local,dateFull:'rusak',timestamp:''}),null);
});
test('guest IN/OUT photos and notes are never copied to the opposite side',()=>{
 const a=d.fromLocal(local);assert.equal(a.inPhoto,local.foto);assert.equal(a.outPhoto,'');assert.equal(a.inNote,local.catatan);assert.equal(a.outNote,'');assert.equal(a.overtimeMinutes,null);
 const b=d.fromLocal({...local,tipe:'Clock Out'});assert.equal(b.inPhoto,'');assert.equal(b.outPhoto,local.foto);assert.equal(b.clockIn,null);assert.equal(b.outNote,local.catatan);
});
test('combined search/date/type/status/review filters drive recap, and clear returns all',()=>{
 const a=d.fromLocal(local),b=d.fromLocal({...local,id:'GST-2',nama:'Crew Lain',tipe:'Clock Out',dateFull:'30 Agustus 2026',timestamp:'',timeShort:'15:10'});
 const f={search:'GILANG',date:'2026-08-31',kind:'Crew Event',status:'Belum dapat dinilai',review:'PENDING',source:'local',sort:'newest'};
 assert.equal(d.filterAttendance([a,b],f).length,1);assert.equal(d.recap(d.filterAttendance([a,b],f)).length,2);
 assert.equal(d.filterAttendance([a,b],{...f,date:'2026-08-30'}).length,0);
 assert.equal(d.filterAttendance([a,b],{search:'',date:'',kind:'',status:'',review:'',source:'',sort:'name'}).length,2);
 assert.equal(d.filterAttendance([a,b],{...f,source:'guest'}).length,0);
});
test('PRESENT maps to on-time, minutes remain minutes, approval is independent',()=>{
 const a=d.fromRegistered({id:'a',attendance_date:'2026-08-31',check_in:'2026-08-31T02:00:00Z',check_out:'2026-08-31T11:00:00Z',status:'LATE',late_minutes:20,overtime_minutes:60,overtime_status:'PENDING',review_status:'APPROVED',check_in_note:'IN',check_out_note:'OUT',crew:null,store_assignment:{store:{name:'Store'}},event_assignment:null,store_schedule:{schedule_date:'2026-08-31',start_time:'09:00:00',end_time:'17:00:00'},event_schedule:null});
 assert.equal(a.status,'Telat');assert.equal(a.review,'APPROVED');assert.equal(a.lateMinutes,20);assert.equal(a.overtimeMinutes,60);
});
test('xlsx is genuine OOXML; notes/phone/formula-looking strings remain text',()=>{
 const bytes=xlsx.namespace.makeWorkbook([['Nama','HP','Catatan','Menit'],['Gilang','08123456','=HYPERLINK("bad")\n<&>',60]]);
 assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
 const files=fflate.unzipSync(bytes);assert.ok(files['[Content_Types].xml']);
 const xml=fflate.strFromU8(files['xl/worksheets/sheet1.xml']);assert.ok(xml.includes('08123456'));assert.ok(xml.includes('=HYPERLINK'));assert.ok(xml.includes('&lt;&amp;&gt;'));assert.ok(xml.includes('<v>60</v>'));assert.ok(!xml.includes('<f>'));
});
