export function* scheduleMonths(startDate:string,endDate:string){
 const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!valid(startDate)||!valid(endDate)||startDate>endDate)throw new Error('Rentang tanggal tidak valid.');
 let start=startDate;
 while(start<=endDate){const next=new Date(`${start}T00:00:00Z`);next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);const last=new Date(next.getTime()-86400000).toISOString().slice(0,10);yield {startDate:start,endDate:last<endDate?last:endDate};start=next.toISOString().slice(0,10);}
}
export interface ScheduleResult {created:number;crewCount?:number;skippedHoliday:number;skippedExisting:number;skippedEvent:number;skippedDay:number;warnings?:string[]}
export async function submitScheduleRange(post:(body:Record<string,unknown>)=>Promise<ScheduleResult>,body:Record<string,unknown>&{startDate:string;endDate:string},progress:(value:string)=>void){
 const total:ScheduleResult={created:0,crewCount:0,skippedHoliday:0,skippedExisting:0,skippedEvent:0,skippedDay:0,warnings:[]};
 for(const range of scheduleMonths(body.startDate,body.endDate)){
  progress(`Memproses ${range.startDate} – ${range.endDate}. ${total.created} jadwal telah dibuat. Tetap buka halaman ini.`);
  let result:ScheduleResult;
  try{result=await post({...body,...range});}catch(error){throw new Error(`${total.created} jadwal telah dibuat. Proses berhenti pada ${range.startDate}. ${error instanceof Error?error.message:'Gagal menyimpan.'} Kirim ulang rentang yang sama untuk melanjutkan; jadwal yang sudah ada dilewati.`);}
  for(const key of ['created','skippedHoliday','skippedExisting','skippedEvent','skippedDay'] as const)total[key]+=result[key];
  total.crewCount=Math.max(total.crewCount||0,result.crewCount||0);total.warnings=[...new Set([...(total.warnings||[]),...(result.warnings||[])])];
 }
 return total;
}
