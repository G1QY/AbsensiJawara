import type {Crew} from './adminData';
export interface PayrollAttendance {id:string;crew_id:string;attendance_date:string;check_in:string|null;check_out:string|null;status:string;review_status:string;overtime_status:string;overtime_minutes:number;late_minutes:number;store_schedule_id?:string;event_schedule_id?:string}
export interface PayrollRules {eventBasis:'MONTHLY'|'PER_ATTENDANCE';storeBasis:'MONTHLY'|'PER_ATTENDANCE';lateRate:number;overtimeRate:number}
export interface PayrollContext {schedules:Array<{crew_id:string;schedule_date:string}>;permissions:Array<{crew_id:string;start_date:string;end_date:string;type:string;status:string}>}
export const DEFAULT_PAYROLL_RULES:PayrollRules={eventBasis:'PER_ATTENDANCE',storeBasis:'MONTHLY',lateRate:10000,overtimeRate:10000};
let sessionRules:PayrollRules={...DEFAULT_PAYROLL_RULES};
export const getPayrollRules=()=>({...sessionRules});
export const rememberPayrollRules=(rules:PayrollRules)=>{sessionRules={...rules};};
export function monthKeys(end:string,count=6){const [y,m]=end.split('-').map(Number);return Array.from({length:count},(_,i)=>new Date(Date.UTC(y,m-count+i,1)).toISOString().slice(0,7));}
export function estimatePayroll(crew:Crew[],attendance:PayrollAttendance[],month:string,rules:PayrollRules,context?:PayrollContext){
  return crew.filter(c=>c.status==='ACTIVE'||attendance.some(a=>a.crew_id===c.id&&a.attendance_date.startsWith(month))).map(c=>{
    const all=attendance.filter(a=>a.crew_id===c.id&&a.attendance_date.startsWith(month));
    const rows=all.filter(a=>a.check_in&&a.check_out&&['PRESENT','LATE'].includes(a.status)&&['APPROVED','NOT_REQUIRED'].includes(a.review_status));
    const lateHours=rows.reduce((n,a)=>n+Math.ceil(Math.max(0,Number(a.late_minutes)||0)/60),0);
    const overtimeHours=rows.filter(a=>a.overtime_status==='APPROVED').reduce((n,a)=>n+Math.floor(Math.max(0,Number(a.overtime_minutes)||0)/60),0);
    const basis=c.crew_type==='CREW_EVENT'?rules.eventBasis:rules.storeBasis;
    const units=basis==='MONTHLY'?1:rows.length,base=Number(c.base_salary)*units;
    const lateDeduction=lateHours*rules.lateRate,bonus=overtimeHours*rules.overtimeRate;
    const scheduleDates=c.crew_type==='CREW_STORE'?[...new Set((context?.schedules||[]).filter(s=>s.crew_id===c.id&&s.schedule_date.startsWith(month)).map(s=>s.schedule_date))]:[];
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
    const attendedDates=new Set(rows.map(row=>row.attendance_date));
    const hasPermission=(date:string)=>(context?.permissions||[]).some(p=>p.crew_id===c.id&&p.status==='APPROVED'&&date>=p.start_date&&date<=p.end_date);
    const absentDays=scheduleDates.filter(date=>date<today&&!attendedDates.has(date)&&!hasPermission(date)).length;
    const dailyRate=basis==='MONTHLY'&&scheduleDates.length?base/scheduleDates.length:0;
    const absenceDeduction=basis==='MONTHLY'&&scheduleDates.length?Math.round(base*absentDays/scheduleDates.length):0;
    const deduction=lateDeduction+absenceDeduction;
    return {crew:c,baseRate:Number(c.base_salary),basis,units,base,lateHours,overtimeHours,lateDeduction,absenceDeduction,absentDays,scheduledDays:scheduleDates.length,dailyRate,deduction,bonus,total:Math.max(0,base+bonus-deduction),excluded:all.length-rows.length,attendance:rows};
  });
}
export type PayrollRow=ReturnType<typeof estimatePayroll>[number];
export function payrollSheet(rows:PayrollRow[],month:string,rules:PayrollRules){return [['Periode','Nama','Jenis','Dasar Gaji','Tarif Pokok','Unit','Gaji Pokok','Hari Terjadwal','Hari Absen','Tarif Harian','Potongan Absen','Jam Telat','Tarif Potongan/Jam','Potongan Telat','Total Potongan','Jam Lembur Disetujui','Tarif Lembur/Jam','Bonus','Estimasi','Catatan Dikecualikan'],...rows.map(r=>[month,r.crew.user.full_name,r.crew.crew_type,r.basis,r.baseRate,r.units,r.base,r.scheduledDays,r.absentDays,r.dailyRate,r.absenceDeduction,r.lateHours,rules.lateRate,r.lateDeduction,r.deduction,r.overtimeHours,rules.overtimeRate,r.bonus,r.total,r.excluded])];}
