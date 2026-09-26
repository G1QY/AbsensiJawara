import {useState} from 'react';
import {t, tx, getLocale} from '../../lib/i18n';
import {accountRoles} from '../../lib/accountRoles';
import {control} from './adminData';
export interface AuditEntry {
  id:string; created_at:string; action:string; entity_type:string; entity_id:string|null;
  actor_user_id:string|null; actor_name?:string; entity_name?:string;
  actor?:{full_name?:string;email?:string}|null;
  old_data?:Record<string,any>|null; new_data?:Record<string,any>|null;
}
const actions:Record<string,string> = {
  CREW_CREATE:'Menambahkan karyawan', CREW_CREATED:'Menambahkan karyawan',
  CREW_UPDATE:'Mengubah data karyawan', CREW_UPDATED:'Mengubah data karyawan', CREW_DELETED:'Menghapus karyawan',
  CREW_EMAIL_CHANGED:'Mengubah email akun', CREW_PASSWORD_RESET:'Mengatur ulang password',
  CREW_PASSWORD_REVEAL_REQUEST:'Meminta akses lihat password', CREW_PASSWORD_COPY_SAVED:'Menyimpan salinan password',
  ACCOUNT_ROLE_CHANGED:'Mengubah role akun', PAYROLL_ADJUSTMENT:'Menyimpan penyesuaian gaji',
  PAYROLL_POLICY:'Mengatur aturan payroll', PAYROLL_FINALIZE:'Memfinalkan payroll',
  PAYROLL_PAID:'Mencatat pembayaran gaji', PAYROLL_REOPEN:'Membuka kembali payroll',
  STORE_SCHEDULE_RANGE_CREATED:'Membuat jadwal rentang tanggal', STORE_SCHEDULE_CREATED:'Membuat jadwal', STORE_SCHEDULE_UPDATED:'Mengubah jadwal',
  ATTENDANCE_APPROVED:'Menyetujui absensi', ATTENDANCE_REJECTED:'Menolak absensi', ATTENDANCE_DELETED:'Menghapus absensi',
  OVERTIME_APPROVED:'Menyetujui lembur', OVERTIME_REJECTED:'Menolak lembur', OVERTIME_SCHEDULE_APPROVED:'Mengizinkan lembur terjadwal',
  WORKFLOW_SAVED:'Menyimpan kegiatan event', WORKFLOW_COMPLETED:'Menyelesaikan kegiatan event',
  DIRECTORY_ARCHIVED:'Mengarsipkan lokasi', DIRECTORY_DELETED:'Menghapus lokasi', NATIONAL_HOLIDAY_SYNCED:'Memperbarui hari libur',
};
const entities:Record<string,string> = {crew:'Karyawan',users:'Akun',payroll:'Payroll',store_schedules:'Jadwal kerja',attendance_logs:'Absensi karyawan',guest_attendances:'Absensi guest',stores:'Store / kantor',branches:'Cabang',events:'Event',national_holidays:'Hari libur'};
function role(value:unknown):string {return typeof value === 'string' ? t(accountRoles[value === 'ADMIN_STORE' ? 'HEAD_STORE' : value] || value) : t('Tidak tercatat');}
function context(row:AuditEntry):string {
  const next=row.new_data||{}, prev=row.old_data||{};
  if(row.action==='ACCOUNT_ROLE_CHANGED') {
    const old=Array.isArray(prev.roles)?prev.roles.map(role).join(', '):role(prev.role);
    return `${old || t('Tidak tercatat')} → ${role(next.role)}${next.division ? ` · ${next.division}` : ''}${next.city ? ` · ${next.city}` : ''}`;
  }
  if(row.action==='STORE_SCHEDULE_RANGE_CREATED') return [next.startDate && next.endDate?`${next.startDate} → ${next.endDate}`:'',next.shiftNumber?`${t('Shift')} ${next.shiftNumber}`:'',Number.isFinite(next.crewCount)?tx('{count} karyawan',{count:next.crewCount}):'',Number.isFinite(next.created)?tx('{count} jadwal',{count:next.created}):''].filter(Boolean).join(' · ');
  if(row.entity_type==='payroll') return next.period || prev.period ? `${t('Periode')}: ${String(next.period || prev.period).slice(0,7)}` : '';
  return '';
}
export default function AuditTrail({rows}:{rows:AuditEntry[]}) {
  const [search,setSearch]=useState(''), [action,setAction]=useState('');
  const actionLabel=(code:string)=>t(actions[code]||'Aktivitas lainnya');
  const shown=rows.filter(r=>(!action||r.action===action)&&[actionLabel(r.action),r.action,r.entity_name,r.actor_name,r.actor?.email,context(r)].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const activity=(r:AuditEntry)=><><p className="font-semibold text-slate-900">{actionLabel(r.action)}</p>{context(r)&&<p className="mt-1 text-xs text-slate-500 break-words">{context(r)}</p>}<details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">{t('Kode aktivitas')}</summary><p className="mt-1 break-all">{r.action}</p></details></>;
  const person=(r:AuditEntry)=><><p className="font-medium break-words">{r.actor_name||r.actor?.full_name||t('Pengguna tidak tersedia')}</p>{r.actor?.email&&<p className="text-xs text-slate-500 mt-1 break-all">{r.actor.email}</p>}</>;
  const target=(r:AuditEntry)=><><p className="font-medium break-words">{r.action==='PAYROLL_POLICY' ? t('Aturan payroll') : (r.entity_name||t('Nama data tidak tersedia'))}</p><p className="text-xs text-slate-500 mt-1">{t(entities[r.entity_type]||'Data lainnya')}</p></>;
  const time=(r:AuditEntry)=>new Date(r.created_at).toLocaleString(getLocale(),{timeZone:'Asia/Jakarta'});
  return <section className="space-y-4">
    <div className="flex flex-col sm:flex-row gap-3"><input className={`${control} flex-1 min-w-0`} aria-label={t('Cari aktivitas audit')} placeholder={t('Cari aktivitas, karyawan, atau akun...')} value={search} onChange={e=>setSearch(e.target.value)} /><select className={`${control} sm:max-w-xs`} aria-label={t('Filter tindakan')} value={action} onChange={e=>setAction(e.target.value)}><option value="">{t('Semua tindakan')}</option>{[...new Set(rows.map(r=>r.action))].sort().map(code=><option key={code} value={code}>{actions[code]?actionLabel(code):code}</option>)}</select></div>
    <p className="text-xs text-slate-500">{tx('Menampilkan {shown} dari {total} aktivitas terbaru.',{shown:shown.length,total:rows.length})} {t('Maksimal 200 aktivitas. Isi password tidak ditampilkan.')}</p>
    <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{['Waktu (WIB)','Aktivitas','Data terkait','Akun pelaksana'].map(h=><th className="text-left p-4" key={h}>{t(h)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{shown.map(r=><tr key={r.id}><td className="p-4 align-top whitespace-nowrap text-slate-600">{time(r)}</td><td className="p-4 align-top max-w-sm">{activity(r)}</td><td className="p-4 align-top max-w-xs">{target(r)}</td><td className="p-4 align-top max-w-xs">{person(r)}</td></tr>)}</tbody></table></div>
    <div className="md:hidden space-y-3">{shown.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-3"><p className="text-xs text-slate-500">{time(r)} WIB</p><div>{activity(r)}</div><div className="border-t border-slate-100 pt-3">{target(r)}</div><div><p className="text-xs text-slate-500 mb-1">{t('Akun pelaksana')}</p>{person(r)}</div></article>)}</div>
    {!shown.length&&<p className="text-center py-8 text-sm text-slate-500">{t('Belum ada data yang sesuai.')}</p>}
  </section>;
}
