import type { GuestAttendanceRecord } from '../guest/GuestCrewPortal';
export type Source = 'registered' | 'guest' | 'local';
export interface Schedule { schedule_date: string; start_time: string; end_time: string; late_tolerance_minutes?: number }
export interface RegisteredAttendance {
  id:string; attendance_date:string; check_in:string|null; check_out:string|null; status:string; late_minutes:number;
  overtime_minutes:number; overtime_status:string; review_status:string; review_note:string;
  check_in_note:string; check_out_note:string; inPhoto?:string; outPhoto?:string;
  crew:{employee_code:string;user:{full_name:string;email:string;phone_number:string}}|null;
  store_assignment:{store:{name:string}}|null; event_assignment:{event:{event_name:string}}|null;
  store_schedule:Schedule|null; event_schedule:Schedule|null;
}
export interface ServerGuest {
 assignment_kind?: "STORE" | "EVENT" | "OFFICE";
  id:string;legacy_id:string|null;full_name:string;phone:string;crew_type:string;location_name:string;position:string;
  clock_type:'IN'|'OUT';occurred_at:string;received_at:string;time_source:string;note:string;review_status:string;review_note:string;
  inPhoto?:string;outPhoto?:string;
}
export interface AttendanceRow {
  id:string;source:Source;name:string;phone:string;email:string;employeeCode:string;kind:string;location:string;date:string;
  schedule:Schedule|null;clockIn:string|null;clockOut:string|null;status:string;lateMinutes:number|null;overtimeMinutes:number|null;
  overtimeStatus:string;review:string;reviewNote:string;inNote:string;outNote:string;inPhoto:string;outPhoto:string;
  legacy?:GuestAttendanceRecord; timeSource:string;
}
export const wibDate=(value:string|Date=new Date())=>{
  const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(date);
};
export const stamp=(value:string|null)=>value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Belum tercatat';
export function legacyTime(g:GuestAttendanceRecord):string|null {
  if(g.occurredAt && Number.isFinite(Date.parse(g.occurredAt)))return g.occurredAt;
  const months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  const text=`${g.dateFull||''} ${g.timestamp||''}`.toLowerCase();
  const d=text.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})/);
  const t=(g.timeShort||'').match(/^(\d{1,2})[.:](\d{2})$/)||text.match(/(?:•|pukul)\s*(\d{1,2})[.:](\d{2})/);
  if(!d||!t||+t[1]>23||+t[2]>59)return null;
  const day=`${d[3]}-${String(months.indexOf(d[2])+1).padStart(2,'0')}-${d[1].padStart(2,'0')}`;
  const iso=`${day}T${t[1].padStart(2,'0')}:${t[2]}:00+07:00`;
  return Number.isFinite(Date.parse(iso))&&wibDate(iso)===day?iso:null;
}
export const reviewLabel=(v:string)=>({PENDING:'Menunggu tinjauan',APPROVED:'Disetujui',REJECTED:'Ditolak',NOT_REQUIRED:'Tidak perlu tinjau',NONE:'Tidak ada'}[v]||v);
export const scheduleLabel=(s:Schedule|null)=>s?`${s.start_time.slice(0,5)} – ${s.end_time.slice(0,5)} WIB${s.end_time<=s.start_time?' (+1 hari)':''}`:'Belum ada jadwal';
export function fromRegistered(a:RegisteredAttendance):AttendanceRow {
  const schedule=a.store_schedule||a.event_schedule;
  const status=({PRESENT:'Tepat Waktu',ON_TIME:'Tepat Waktu',LATE:'Telat',ABSENT:'Tidak hadir',PERMISSION:'Izin',SICK:'Sakit',HOLIDAY:'Libur',NOT_SCHEDULED:'Tidak dijadwalkan',PENDING:schedule?'Menunggu verifikasi':'Belum dapat dinilai'} as Record<string,string>)[a.status]||a.status;
  return {id:a.id,source:'registered',name:a.crew?.user?.full_name||'Crew',phone:a.crew?.user?.phone_number||'',email:a.crew?.user?.email||'',employeeCode:a.crew?.employee_code||'',kind:a.event_assignment?'Crew Event':'Crew Store',location:a.event_assignment?.event?.event_name||a.store_assignment?.store?.name||'Lokasi belum tersedia',date:a.attendance_date,schedule,clockIn:a.check_in,clockOut:a.check_out,status,
    lateMinutes:schedule&&a.check_in?a.late_minutes:null,overtimeMinutes:schedule&&a.check_out?a.overtime_minutes:null,overtimeStatus:a.overtime_status||'NONE',review:a.review_status||'NOT_REQUIRED',reviewNote:a.review_note||'',inNote:a.check_in_note||'',outNote:a.check_out_note||'',inPhoto:a.check_in?a.inPhoto||'':'',outPhoto:a.check_out?a.outPhoto||'':'',timeSource:'SERVER'};
}
export function fromGuest(g:ServerGuest):AttendanceRow {
  const isKantor = g.assignment_kind === 'OFFICE' || (!g.assignment_kind && ((g.location_name || '').toLowerCase().includes('kantor') || (g.position || '').toLowerCase().includes('kantor')));
  return {id:g.id,source:'guest',name:g.full_name,phone:g.phone,email:'',employeeCode:g.legacy_id||'',kind:isKantor ? 'Kantor' : g.crew_type==='CREW_STORE'?'Crew Store':'Crew Event',location:g.location_name,date:wibDate(g.occurred_at),schedule:null,clockIn:g.clock_type==='IN'?g.occurred_at:null,clockOut:g.clock_type==='OUT'?g.occurred_at:null,status:'Belum dapat dinilai',lateMinutes:null,overtimeMinutes:null,overtimeStatus:'NONE',review:g.review_status,reviewNote:g.review_note||'',inNote:g.clock_type==='IN'?g.note:'',outNote:g.clock_type==='OUT'?g.note:'',inPhoto:g.clock_type==='IN'?g.inPhoto||'':'',outPhoto:g.clock_type==='OUT'?g.outPhoto||'':'',timeSource:g.time_source};
}
export function fromLocal(g:GuestAttendanceRecord):AttendanceRow {
  const time=legacyTime(g);
  return {...fromGuest({id:g.id,legacy_id:g.id,full_name:g.nama,phone:g.hp,crew_type:g.jenis==='Crew Event'?'CREW_EVENT':'CREW_STORE',location_name:g.lokasi,position:g.posisi,clock_type:g.tipe==='Clock In'?'IN':'OUT',occurred_at:time||'',received_at:'',time_source:'LEGACY_DEVICE',note:g.catatan||'',review_status:'PENDING',review_note:'',inPhoto:g.tipe==='Clock In'?g.foto:'',outPhoto:g.tipe==='Clock Out'?g.foto:''}),kind:g.jenis,source:'local',legacy:g};
}
export interface Filters {search:string;date:string;kind:string;status:string;review:string;source:string;sort:string}
export function filterAttendance(rows:AttendanceRow[],f:Filters) {
  const search=f.search.trim().toLocaleLowerCase('id-ID');
  const filtered=rows.filter(a=>(!f.date||a.date===f.date)&&(!f.kind||a.kind===f.kind)&&(!f.status||a.status===f.status)&&(!f.review||a.review===f.review)&&(!f.source||a.source===f.source)&&[a.name,a.phone,a.email,a.employeeCode,a.location].join(' ').toLocaleLowerCase('id-ID').includes(search));
  return [...filtered].sort((a,b)=>f.sort==='name'?a.name.localeCompare(b.name,'id-ID'):f.sort==='oldest'?(a.clockIn||a.clockOut||'').localeCompare(b.clockIn||b.clockOut||''):f.sort==='status'?a.status.localeCompare(b.status,'id-ID'):(b.clockIn||b.clockOut||'').localeCompare(a.clockIn||a.clockOut||''));
}
export function recap(rows:AttendanceRow[]):(string|number|null)[][] {
  return [['ID Absensi','Sumber','Tanggal Kerja (WIB)','Nama Crew','HP','Email','Jenis','Event / Store','Jadwal','Clock In (WIB)','Clock Out (WIB)','Status Kehadiran','Telat (menit)','Lembur (menit)','Persetujuan Lembur','Persetujuan Absensi','Catatan Clock In','Catatan Clock Out','Catatan Admin','Sumber Waktu'],...rows.map(a=>[
    a.id,a.source==='local'?'Guest lokal belum sinkron':a.source==='guest'?'Guest server':'Crew terdaftar',a.date,a.name,a.phone,a.email,a.kind,a.location,scheduleLabel(a.schedule),a.clockIn?stamp(a.clockIn):'',a.clockOut?stamp(a.clockOut):'',a.status,a.lateMinutes,a.overtimeMinutes,a.overtimeMinutes===null?'Belum dapat dihitung':reviewLabel(a.overtimeStatus),a.source==='local'?'Belum disimpan ke server':reviewLabel(a.review),a.inNote,a.outNote,a.reviewNote,a.timeSource==='LEGACY_DEVICE'?'Perangkat (data lama)':'Server'
  ])];
}
