const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
function load(name){const ctx={exports:{},require:name=>{assert.equal(name,'../../lib/accountRoles');const roles={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/accountRoles.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,roles);return roles.exports;}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/pages/admin',name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);return ctx.exports;}
const attendance=load('attendanceData.ts');
test('registered office identity reaches display, search and Excel',()=>{
 const row=attendance.fromRegistered({id:'a',attendance_date:'2026-09-11',status:'PRESENT',crew:{company_name:'Fotosnaps',job_title:'Kasir',user:{full_name:'Test Crew'}},store_assignment:{store:{name:'HQ',location_kind:'OFFICE'}}});
 assert.equal(row.kind,'Kantor');assert.equal(row.companyName,'Fotosnaps');assert.equal(row.jobTitle,'Kasir');
 const sheet=attendance.recap([row]);assert.equal(sheet[0].length,sheet[1].length);assert.equal(sheet[1][sheet[0].indexOf('Perusahaan')],'Fotosnaps');
 assert.equal(attendance.filterAttendance([row],{search:'Kasir'}).length,1);
});
test('guest identity remains supplied snapshot, not a guessed employee match',()=>{
 const row=attendance.fromGuest({id:'g',full_name:'Guest',phone:'0812345678',company_name:'Jawara Group',job_title:'Supervisor',crew_type:'CREW_STORE',assignment_kind:'OFFICE',location_name:'HQ',clock_type:'IN',occurred_at:'2026-09-11T06:00:00Z'});
 assert.equal(row.jobTitle,'Supervisor');assert.equal(row.companyName,'Jawara Group');assert.equal(row.kind,'Kantor');
});
test('persisted payroll exports retain company, job, exact amounts and status',()=>{
 const ctx={exports:{},require:()=>({})};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/pages/payroll/payrollApi.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);
 const sheet=ctx.exports.payrollExport([{month:'2026-09',person:{full_name:'Test',company_name:'Fotosnaps',job_title:'Kasir'},placements:[],basis:'MONTHLY',status:'PAID',baseRate:100,units:1,base:100,total:90,cappedDeduction:10,adjustment:{note:'Kasbon'}}]);
 assert.equal(sheet[0].length,sheet[1].length);assert.equal(sheet[1][sheet[0].indexOf('Jabatan')],'Kasir');assert.equal(sheet[1][sheet[0].indexOf('Gaji bersih')],90);assert.equal(sheet[1][sheet[0].indexOf('Status')],'Dibayar');
});
