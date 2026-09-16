import {t as translateUI,tx} from '../../lib/i18n';
import {useEffect,useState} from 'react';
import {api} from '../../lib/apiClient';
import {type Crew,button,panel,money,message} from './adminData';
import {type ManagedEvent,eventHours} from './EventWorkspace';
import {type PayrollAttendance,type PayrollContext,estimatePayroll,getPayrollRules,monthKeys} from './payrollData';
import {MiniChart,Stat,DataTable,EventBadge} from './adminWidgets';
import {wibDate,stamp} from './attendanceData';
type RevenueMonth = {month:string;revenue:number;recordedEvents:number;missingEvents:number;unfinishedEvents:number};
type RevenueSummary = {month:string;months:RevenueMonth[];current:RevenueMonth};
export default function DashboardWorkspace(){
 const [revenue,setRevenue]=useState<RevenueSummary|null>(null);
 const [payrollContext,setPayrollContext]=useState<PayrollContext>({schedules:[],permissions:[]});
 const [crew,setCrew]=useState<Crew[]>([]),[events,setEvents]=useState<ManagedEvent[]>([]),[logs,setLogs]=useState<PayrollAttendance[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  try{
   const period=wibDate().slice(0,7);
   const [c,e,a,r,p]=await Promise.all([
    api.get<Crew[]>('/crew'),api.get<ManagedEvent[]>('/admin-events'),
    api.get<{registered:PayrollAttendance[]}>('/admin-attendance'),
    api.get<RevenueSummary>(`/dashboard/revenue?month=${period}`),
    api.get<PayrollContext>(`/admin-store-schedules/payroll-context?month=${period}`),
   ]);
   setCrew(c);setEvents(e);setLogs(a.registered);setRevenue(r);setPayrollContext(p);
  }catch(e){setError(message(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const today=wibDate(),month=today.slice(0,7),months=monthKeys(month),active=crew.filter(c=>c.status==='ACTIVE'),accepted=logs.filter(a=>a.check_in&&a.review_status!=='REJECTED'),current=logs.filter(a=>a.attendance_date===today);
 const payroll=estimatePayroll(crew,logs,month,getPayrollRules(),payrollContext);
 const payrollSum=(key:'total'|'base'|'bonus'|'deduction')=>payroll.reduce((sum,row)=>sum+row[key],0);
 const omzet=revenue?.current;
 const revenueNote=omzet ? tx('{recorded} event sudah mengisi omzet, {missing} belum mengisi. {unfinished} workflow belum selesai.',{recorded:omzet.recordedEvents,missing:omzet.missingEvents,unfinished:omzet.unfinishedEvents}) : '';
 const days=Array.from({length:7},(_,i)=>{const d=new Date(today+'T12:00:00+07:00');d.setUTCDate(d.getUTCDate()-6+i);return wibDate(d);});
 return <div className="p-4 sm:p-6 space-y-5"><div className="flex justify-between items-center"><div><h2 className="text-lg font-bold text-slate-900">Dashboard</h2><p className="text-xs text-slate-500">{translateUI("Ringkasan") + " "}{today}{" " + translateUI("• WIB • Data server")}</p></div><button className={button} disabled={loading} onClick={()=>void load()}>{translateUI("Muat ulang")}</button></div>{error&&<p role="alert" className="ui-error p-4 rounded-xl">{translateUI(error)}</p>}{loading?<p>{translateUI("Memuat dashboard...")}</p>:!error&&<><div className="dashboard-stats grid grid-cols-2 xl:grid-cols-6 gap-3"><Stat label={translateUI("Total Crew Aktif")} value={active.length} tone="plain"/><Stat label={translateUI("Crew Event")} value={active.filter(c=>c.crew_type==='CREW_EVENT').length} tone="plain"/><Stat label={translateUI("Crew Store")} value={active.filter(c=>c.crew_type==='CREW_STORE').length} tone="plain"/><Stat label={translateUI("Event Berlangsung")} value={events.filter(e=>e.status==='ONGOING').length} tone="plain"/><Stat label={translateUI("Omzet Event Bulan Ini")} value={money(omzet?.revenue ?? 0)} sub={revenueNote} tone="plain"/><Stat label={translateUI("Estimasi Payroll Bulan Ini")} value={money(payrollSum('total'))} sub={translateUI("Mengikuti aturan sesi pada menu Payroll. Belum pembayaran final.")} tone="plain"/></div><div className="grid lg:grid-cols-3 gap-4"><MiniChart title={translateUI("Event per Bulan")} subtitle={translateUI("6 bulan terakhir, berdasarkan tanggal event")} points={months.map(m=>({label:m.slice(5),value:events.filter(e=>e.event_date.startsWith(m)&&e.status!=='CANCELLED').length}))}/><MiniChart title={translateUI("Kehadiran Crew")} subtitle={translateUI("7 hari terakhir, catatan check-in tidak ditolak")} color="#059669" points={days.map(d=>({label:d.slice(8),value:accepted.filter(a=>a.attendance_date===d).length}))}/><MiniChart title={translateUI("Lembur Disetujui")} subtitle={translateUI("6 bulan terakhir, jam penuh dari absensi sah")} points={months.map(m=>({label:m.slice(5),value:logs.filter(a=>a.attendance_date.startsWith(m)&&a.check_in&&a.check_out&&['PRESENT','LATE'].includes(a.status)&&['APPROVED','NOT_REQUIRED'].includes(a.review_status)&&a.overtime_status==='APPROVED').reduce((n,a)=>n+Math.floor(a.overtime_minutes/60),0)}))}/></div><div className="grid lg:grid-cols-2 gap-4"><MiniChart title={translateUI("Omzet Event per Bulan")} subtitle={translateUI("6 bulan, tunai + transfer tersimpan. Berdasarkan tanggal event, termasuk workflow belum selesai.")} color="#059669" format={money} points={(revenue?.months||[]).map(row=>({label:row.month,value:row.revenue}))}/><MiniChart title={translateUI("Komponen Estimasi Payroll")} subtitle={tx('Periode {month}, seluruh crew. Sama dengan menu Payroll tanpa filter.',{month})} format={money} points={[{label:'Gaji pokok',value:payrollSum('base')},{label:'Bonus',value:payrollSum('bonus')},{label:'Potongan',value:payrollSum('deduction')}]}/></div><div className="grid xl:grid-cols-2 gap-4"><section className="space-y-3"><h3 className="text-sm font-semibold text-slate-900">{translateUI("Event Terbaru")}</h3><DataTable headers={['Event','Tanggal','PIC','Status']} rows={events.slice(0,5).map(e=>[e.event_name,e.event_date,e.pic?.user.full_name||'Belum ditetapkan',<EventBadge status={e.status}/>])}/></section><section className="space-y-3"><h3 className="text-sm font-semibold text-slate-900">{translateUI("Absensi Hari Ini")}</h3><DataTable headers={['Crew','Clock In WIB','Status']} rows={current.slice(0,8).map(a=>[crew.find(c=>c.id===a.crew_id)?.user.full_name||'Crew',stamp(a.check_in),a.status])}/></section></div><section className={panel}><h3 className="text-sm font-semibold text-slate-900">{translateUI("Event Sedang Berlangsung")}</h3><div className="grid md:grid-cols-3 gap-3 mt-4">{events.filter(e=>e.status==='ONGOING').map(e=><div className="bg-blue-50 text-blue-800 rounded-xl p-4" key={e.id}><p className="font-semibold text-sm">{e.event_name}</p><p className="text-xs mt-1">{e.event_locations[0]?.address||'Lokasi belum diisi'}</p><p className="text-xs mt-2">{eventHours(e)} • {e.event_assignments.filter(a=>a.status==='ACTIVE').length} crew</p></div>)}</div>{!events.some(e=>e.status==='ONGOING')&&<p className="text-sm text-slate-500 mt-3">{translateUI("Belum ada event berlangsung.")}</p>}</section></>}</div>;
}
