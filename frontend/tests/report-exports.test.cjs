const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const {unzipSync,strFromU8}=require('fflate');
function load(file,deps={}){const ctx={exports:{},require:id=>deps[id]||require(id),Intl,Date,Uint8Array,console};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,ctx);return ctx.exports;}
const xlsx=load('lib/xlsxExport.ts');
const report=load('utils/exportUtils.ts',{'../lib/xlsxExport':xlsx});
test('same identity and column order are used for XLSX and PDF',()=>{const data=report.withExportContext(['Jumlah'],[[5]],{'Nama Crew':'Contoh','Perusahaan':'Fotosnaps','Jabatan':'Kasir'});assert.deepEqual(Array.from(data.headers),['Nama Crew','Perusahaan','Jabatan','Jumlah']);assert.equal(data.rows[0][2],'Kasir');assert.equal(data.rows[0][3],5);assert.throws(()=>report.withExportContext(['A'],[[1,2]]));});
test('XLSX preserves phone numbers and user strings without formulas; supports 26 columns',()=>{
 const data=[Array.from({length:26},(_,i)=>'Kolom '+i),['08123456789','=HYPERLINK("test")','<Crew & Company>',...Array.from({length:23},()=>123)]];
 const zip=unzipSync(xlsx.makeWorkbook(data));const xml=strFromU8(zip['xl/worksheets/sheet1.xml']);
 assert.match(xml,/08123456789/);assert.match(xml,/&lt;Crew &amp; Company&gt;/);assert.ok(!xml.includes('<f>'));assert.match(xml,/max="26"/);
 if(process.env.EXPORT_PROOF_DIR){fs.mkdirSync(process.env.EXPORT_PROOF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.EXPORT_PROOF_DIR,'export-proof.xlsx'),xlsx.makeWorkbook(data));}
});
test('wide multi-page PDF includes all rows and saves as actual PDF',async()=>{
 const headers=['Nama','Perusahaan','Jabatan',...Array.from({length:20},(_,i)=>'Nilai '+i)];
 const rows=Array.from({length:65},(_,i)=>['Crew '+i,'Fotosnaps','Supervisor',...Array.from({length:20},(_,j)=>`Nilai-${i}-${j}`)]);
 const doc=await report.makeReportPDF('Rekap Absensi','Data uji saja',headers,rows);
 assert.ok(doc.getNumberOfPages()>1);const output=doc.output();assert.ok(output.startsWith('%PDF-'));assert.ok(output.includes('Crew 64'));assert.ok(output.includes('Nilai-64-19'));
 if(process.env.EXPORT_PROOF_DIR)fs.writeFileSync(path.join(process.env.EXPORT_PROOF_DIR,'export-proof.pdf'),Buffer.from(doc.output('arraybuffer')));
});
