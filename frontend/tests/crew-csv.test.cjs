const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const ctx={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/pages/admin/crewCsv.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);
const parse=ctx.exports.parseCrewCsv;
const header='nama,email,password,perusahaan,jabatan,no_hp\r\n';
test('CSV keeps quoted company, blank job, and phone leading zero; no inferred role',()=>{
 const r=parse('\uFEFF'+header+'Test User,test@example.test,Password123,"PT Contoh, Indonesia",,0812345678')[0];
 assert.equal(r.companyName,'PT Contoh, Indonesia');assert.equal(r.jobTitle,'');assert.equal(r.phoneNumber,'0812345678');assert.equal(r.crewType,'');
});
test('duplicate email rejected case insensitively',()=>assert.throws(()=>parse(header+'User A,a@example.test,Password123,Test,,08123\nUser B,A@example.test,Password123,Test,,08123'),/lebih dari satu/));
test('short password rejected without revealing it',()=>assert.throws(()=>parse(header+'Test User,a@example.test,short,Test,,08123'),/password harus/));
test('semicolon CSV supported',()=>assert.equal(parse('nama;email;password;perusahaan;jabatan;no_hp\nTest User;a@example.test;Password123;Test;Kasir;08123')[0].jobTitle,'Kasir'));
test('unclosed quote rejected',()=>assert.throws(()=>parse(header+'"Test User'),/kutip/));
