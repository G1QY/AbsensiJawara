import { downloadWorkbook } from '../lib/xlsxExport';
export type ExportRow = (string | number | null)[];
export type ExportContext = Record<string, string>;
export function withExportContext(headers:string[],rows:ExportRow[],context:ExportContext={}){
 if(rows.some(row=>row.length!==headers.length))throw new Error('Jumlah kolom ekspor tidak sesuai.');
 const keys=Object.keys(context);
 return {headers:[...keys,...headers],rows:rows.map(row=>[...keys.map(key=>context[key]||'Belum diisi'),...row])};
}
function todayStr(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());}
function filename(value:string){return value.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,120);}
export function exportToExcel(name:string,headers:string[],rows:ExportRow[]){
 withExportContext(headers,rows);
 downloadWorkbook([headers,...rows],`${filename(name)}-${todayStr()}.xlsx`);
}
export async function makeReportPDF(title:string,subtitle:string,headers:string[],rows:ExportRow[]){
 withExportContext(headers,rows);
 const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
 const doc=new jsPDF({orientation:headers.length>6?'landscape':'portrait'});
 const width=doc.internal.pageSize.getWidth();
 doc.setFontSize(14);
 const titleLines=doc.splitTextToSize(title,width-28);doc.text(titleLines,14,16);
 doc.setFontSize(9);
 const sub=doc.splitTextToSize(`${subtitle} | Dicetak ${todayStr()} (WIB)`,width-28);
 const subY=20+titleLines.length*6;doc.text(sub,14,subY);
 autoTable(doc,{startY:subY+sub.length*4+5,head:[headers],body:rows.map(row=>row.map(cell=>cell??'')),
  theme:'grid',styles:{fontSize:8,cellPadding:2,overflow:'linebreak',minCellWidth:20},headStyles:{fillColor:[37,99,235]},
  margin:{top:14,right:14,bottom:16,left:14},showHead:'everyPage',horizontalPageBreak:true,horizontalPageBreakRepeat:Math.max(0,headers.findIndex(header=>/^Nama(?: Crew)?$/i.test(header))),
 });
 const total=doc.getNumberOfPages();
 for(let page=1;page<=total;page++){doc.setPage(page);doc.setFontSize(8);doc.text(`JAWARA | ${page} / ${total}`,14,doc.internal.pageSize.getHeight()-8);}
 return doc;
}
export async function exportToPDF(title:string,subtitle:string,headers:string[],rows:ExportRow[]){
 const doc=await makeReportPDF(title,subtitle,headers,rows);doc.save(`${filename(title)}-${todayStr()}.pdf`);
}
