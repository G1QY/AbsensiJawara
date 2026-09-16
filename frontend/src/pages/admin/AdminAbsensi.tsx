import {t as translateUI} from '../../lib/i18n';
import { removeGuestRecord } from '../guest/GuestCrewPortal';
import { gpsLink } from './attendanceData';
import ExportButtons from '../../components/ui/ExportButtons';
import {useState,useEffect} from 'react';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import {api} from '../../lib/apiClient';
import {getGuestAttendances,markGuestSynced} from '../guest/GuestCrewPortal';
import {button,primary,control,message,money} from './adminData';
import {type AttendanceRow,type RegisteredAttendance,type ServerGuest,type Filters,fromRegistered,fromGuest,fromLocal,filterAttendance,recap,wibDate,stamp,scheduleLabel,reviewLabel} from './attendanceData';
import {downloadWorkbook} from '../../lib/xlsxExport';
import {getPayrollRules} from './payrollData';
const emptyFilters:Filters={search:'',date:'',kind:'',status:'',review:'',source:'',sort:'newest'};
function ApprovalBadge({value}:{value:string}) {
  const label=reviewLabel(value),tone=value==='APPROVED'||value==='NOT_REQUIRED'?'bg-emerald-50 text-emerald-700 border-emerald-200':value==='REJECTED'?'bg-red-50 text-red-700 border-red-200':value==='PENDING'?'bg-amber-50 text-amber-700 border-amber-200':'bg-slate-50 text-slate-600 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{translateUI(label)}</span>;
}
export default function AdminAbsensi() {
  const [deleting,setDeleting]=useState<AttendanceRow|null>(null);
  const [deleteReason,setDeleteReason]=useState('');
  const [rows,setRows]=useState<AttendanceRow[]>([]);
  const [filters,setFilters]=useState<Filters>(emptyFilters);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[modalError,setModalError]=useState('');
  const [detail,setDetail]=useState<AttendanceRow|null>(null),[review,setReview]=useState<AttendanceRow|null>(null);
  const [target,setTarget]=useState<'attendance'|'overtime'>('attendance');
  const [note,setNote]=useState(''),[legacyDate,setLegacyDate]=useState('');
  async function load() {
    setLoading(true);setError('');
    try {
      const data=await api.get<{registered:RegisteredAttendance[];guest:ServerGuest[]}>('/admin-attendance');
      const legacy=getGuestAttendances().filter(g=>!g.serverId&&!data.guest.some(s=>s.id===g.serverId||(s.legacy_id===g.id&&s.phone===g.hp&&s.full_name===g.nama)));
      setRows([...data.registered.map(fromRegistered),...data.guest.map(fromGuest),...legacy.map(fromLocal)].sort((a,b)=>(b.clockIn||b.clockOut||'').localeCompare(a.clockIn||a.clockOut||'')));
    }catch(e){setError(message(e));}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  async function getDetail(a:AttendanceRow) {
    if(a.source==='local')return a;
    const data=await api.get<RegisteredAttendance|ServerGuest>(`/admin-attendance/${a.source}/${a.id}`);
    return a.source==='registered'?fromRegistered(data as RegisteredAttendance):fromGuest(data as ServerGuest);
  }
  async function open(a:AttendanceRow,isReview=false) {
    setBusy(true);setModalError('');setNote('');setTarget(a.review==='PENDING'?'attendance':'overtime');setLegacyDate('');
    try{const full=await getDetail(a);if(isReview)setReview(full);else setDetail(full);}catch(e){setError(message(e));}finally{setBusy(false);}
  }
  async function removeAttendance() {
    if(!deleting || !deleteReason.trim())return;
    setBusy(true);setModalError('');
    try {
      if(deleting.source!=='local') await api.delete(`/admin-attendance/${deleting.source}/${deleting.id}`,{reason:deleteReason.trim()});
      removeGuestRecord(deleting.id);
      setDeleting(null);setDetail(null);setReview(null);
      setNotice('Absensi dihapus. Rekap dan ekspor mengikuti data terbaru.');
      await load();
    }catch(e){setModalError(message(e));}finally{setBusy(false);}
  }
  async function importLegacy() {
    if(!review?.legacy)return;setBusy(true);setModalError('');
    try {
      const g=review.legacy;const occurredAt=review.clockIn||review.clockOut||(legacyDate?new Date(legacyDate+':00+07:00').toISOString():'');
      if(!occurredAt)throw new Error('Tanggal data lama belum terbaca. Isi tanggal dan jam sebenarnya (WIB).');
      if(!/^data:image\/(jpeg|png|webp);base64,/.test(g.foto))throw new Error('Foto data lama tidak tersedia atau tidak didukung.');
      const photo=await (await fetch(g.foto)).blob();const form=new FormData();
      for(const [key,value]of Object.entries({companyName:g.companyName||'',jobTitle:g.jobTitle||'',fullName:g.nama,phone:g.hp,crewType:g.jenis==='Crew Event'?'CREW_EVENT':'CREW_STORE',locationName:g.lokasi,position:g.posisi||'',clockType:g.tipe==='Clock In'?'IN':'OUT',occurredAt,legacyId:g.id,note:g.catatan||'',latitude:g.latitude??'',longitude:g.longitude??'',accuracy:g.accuracy??'',address:g.address||''}))form.append(key,String(value));
      form.append('photo',photo,'guest-legacy.jpg');
      const saved=await api.postForm<{id:string}>('/admin-attendance/import-guest',form);
      markGuestSynced(g,saved.id);
      const full=fromGuest(await api.get<ServerGuest>(`/admin-attendance/guest/${saved.id}`));
      setReview(full);setTarget('attendance');setNotice('Data guest lama tersimpan di server. Silakan tinjau.');await load();
    }catch(e){setModalError(message(e));}finally{setBusy(false);}
  }
  async function resolve(decision:'APPROVED'|'REJECTED') {
    if(!review||review.source==='local')return;setBusy(true);setModalError('');
    try {
      if(decision==='REJECTED'&&!note.trim())throw new Error('Isi alasan penolakan terlebih dahulu.');
      await api.patch(`/admin-attendance/${review.source}/${review.id}/review`,{decision,target,note});
      setReview(null);setNotice(`${target==='overtime'?'Lembur':'Pengajuan absensi'} ${decision==='APPROVED'?'disetujui':'ditolak'}. Keputusan tersimpan dan notifikasi dikirim ke akun crew.`);await load();
    }catch(e){setModalError(message(e));}finally{setBusy(false);}
  }
  const filtered=filterAttendance(rows,filters);
  const filter=(key:keyof Filters,value:string)=>setFilters(f=>({...f,[key]:value}));
  const needsReview=(a:AttendanceRow)=>a.review==='PENDING'||(a.overtimeStatus==='PENDING'&&['APPROVED','NOT_REQUIRED'].includes(a.review));
  const metrics=[['Clock In tercatat',filtered.filter(a=>!!a.clockIn).length],['Tepat Waktu',filtered.filter(a=>a.status==='Tepat Waktu').length],['Telat',filtered.filter(a=>a.status==='Telat').length],['Tanpa Clock In',filtered.filter(a=>!a.clockIn).length],['Perlu Ditinjau',filtered.filter(needsReview).length]];
  function positions(a:AttendanceRow) {
    return <div className="grid sm:grid-cols-2 gap-3">{(['in','out'] as const).map(side=>{
      const point=side==='in'?a.inGPS:a.outGPS;
      return <div key={side} className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
        <p className="font-semibold">GPS {side==='in'?'Clock In':'Clock Out'}</p>
        {point?<><p className="mt-1">{point.latitude}, {point.longitude}</p><p>{translateUI("Akurasi:") + " "}{point.accuracy===null?translateUI("Tidak tercatat"):`±${point.accuracy} m`}</p><a className="text-blue-700 underline" href={gpsLink(point)} target="_blank" rel="noopener noreferrer">{translateUI("Buka titik GPS")}</a></>:<p>{translateUI("Koordinat belum tercatat.")}</p>}
      </div>;
    })}</div>;
  }
  function photos(a:AttendanceRow) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(['in','out'] as const).map(side=>{
      const photo=side==='in'?a.inPhoto:a.outPhoto,time=side==='in'?a.clockIn:a.clockOut,comment=side==='in'?a.inNote:a.outNote;
      return <section key={side} className="p-4 rounded-xl bg-slate-50 space-y-3">
        <h3 className="font-semibold text-sm text-slate-900">{side==='in'?'Clock In':'Clock Out'}</h3>
        {photo?<img src={photo} alt={side==='in'?translateUI("Foto Clock In"):translateUI("Foto Clock Out")} className="w-full rounded-xl object-contain max-h-80" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.insertAdjacentText('afterend',translateUI('Foto gagal dimuat. Tutup dan buka ulang detail.'));}}/>:<p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl p-5">{time?translateUI("Foto tidak tersedia untuk catatan ini."):translateUI(side==='in'?'Belum ada foto Clock In.':'Belum ada foto Clock Out.')}</p>}
        <p className="text-sm font-semibold text-slate-900">{translateUI(stamp(time))}</p>
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words"><p className="font-semibold">{translateUI("Catatan") + " "}{side==='in'?translateUI('Clock In'):translateUI('Clock Out')}</p><p>{comment||translateUI('Tidak ada catatan.')}</p></div>
      </section>;
    })}</div>;
  }
  function identity(a:AttendanceRow){return <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl"><Avatar name={a.name}/><div><h3 className="font-semibold text-slate-900">{a.name}</h3><p className="text-sm text-slate-600">{a.companyName || translateUI("Perusahaan belum diisi")} • {a.jobTitle || translateUI("Jabatan belum diisi")}</p><p className="text-sm text-slate-600">{a.kind} • {a.location}</p><p className="text-xs text-slate-500">{a.phone} {a.source!=='registered'?'• Guest':''}</p></div></div>;}
  function calculation(a:AttendanceRow){
    const rules=getPayrollRules(),lateHours=a.lateMinutes===null?null:Math.ceil(Math.max(0,a.lateMinutes)/60),overtimeHours=a.overtimeMinutes===null?null:Math.floor(Math.max(0,a.overtimeMinutes)/60);
    const deduction=lateHours===null?null:lateHours*rules.lateRate,approved=a.overtimeStatus==='APPROVED',bonus=overtimeHours===null?null:approved?overtimeHours*rules.overtimeRate:0;
    return <div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-700">{translateUI("Status Clock In")}</p><p className="font-bold text-slate-900 mt-1">{translateUI(a.status)}</p><p className="text-xs text-slate-600 mt-1">{a.lateMinutes===null?translateUI("Tidak dapat dihitung tanpa jadwal"):a.lateMinutes?`${a.lateMinutes} ${translateUI('menit telat')}`:translateUI("Tepat waktu / lebih awal")}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs text-red-700">{translateUI("Potongan Telat")}</p><p className="font-bold text-red-700 mt-1">{deduction===null?translateUI("Belum dapat dihitung"):'-'+money(deduction)}</p><p className="text-xs text-slate-600 mt-1">{lateHours===null?translateUI("Guest/tanpa jadwal"):`${lateHours} ${translateUI('jam')} × ${money(rules.lateRate)}`}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">{translateUI("Bonus Lembur")}</p><p className="font-bold text-emerald-700 mt-1">{bonus===null?translateUI("Belum dapat dihitung"):'+'+money(bonus)}</p><p className="text-xs text-slate-600 mt-1">{overtimeHours===null?translateUI("Belum Clock Out / tanpa jadwal"):approved?`${overtimeHours} ${translateUI('jam')} × ${money(rules.overtimeRate)}`:`${overtimeHours} ${translateUI('jam')} • ${translateUI(reviewLabel(a.overtimeStatus))}`}</p></div></div>;
  }
  return <div className="p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="font-bold text-lg text-slate-900">{translateUI("Rekap Absensi")}</h2><p className="text-sm text-slate-600">{translateUI("Kehadiran, catatan crew, dan persetujuan lembur.")}</p></div><div className="flex flex-wrap gap-2"><button className={button} disabled={loading||busy} onClick={()=>void load()}>{translateUI("Muat ulang")}</button><ExportButtons filename="Rekap-Absensi" title={translateUI("Rekap Absensi")} subtitle={translateUI("Sesuai filter aktif, waktu WIB")} headers={recap(filtered)[0] as string[]} rows={recap(filtered).slice(1)} /></div></div>
    {error&&<p role="alert" className="text-sm bg-red-50 text-red-700 rounded-xl p-4">{translateUI(error)}{" " + translateUI("Data belum lengkap. Muat ulang sebelum mengekspor.")}</p>}
    {notice&&<p role="status" className="text-sm bg-emerald-50 text-emerald-700 rounded-xl p-4">{translateUI(notice)}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{metrics.map(([label,n])=><div key={label} className="rounded-xl p-4 bg-blue-50 text-blue-700"><p className="text-2xl font-bold">{loading?'...':n}</p><p className="text-xs mt-1">{translateUI(label)}</p></div>)}</div>
    <p className="text-xs text-slate-600">{translateUI("Ringkasan, Excel, dan PDF mengikuti seluruh filter di bawah.")}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
      <label className="text-xs text-slate-600">{translateUI("Cari crew")}<input aria-label={translateUI("Cari crew")} value={filters.search} onChange={e=>filter('search',e.target.value)} className={control} placeholder={translateUI("Nama, HP, email, lokasi...")}/></label>
      <label className="text-xs text-slate-600">{translateUI("Tanggal kerja (WIB)")}<input aria-label={translateUI("Tanggal kerja")} type="date" value={filters.date} onChange={e=>filter('date',e.target.value)} className={control}/></label>
      <label className="text-xs text-slate-600">{translateUI("Jenis")}<select aria-label={translateUI("Jenis crew")} className={control} value={filters.kind} onChange={e=>filter('kind',e.target.value)}><option value="">{translateUI("Semua jenis")}</option><option value={"Crew Event"}>{translateUI("Crew Event")}</option><option value={"Crew Store"}>{translateUI("Crew Store")}</option><option value={"Kantor"}>{translateUI("Kantor")}</option></select></label>
      <label className="text-xs text-slate-600">{translateUI("Status kehadiran")}<select aria-label={translateUI("Status kehadiran")} className={control} value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">{translateUI("Semua status")}</option>{[...new Set(rows.map(a=>a.status))].sort().map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <label className="text-xs text-slate-600">{translateUI("Persetujuan absensi")}<select aria-label={translateUI("Persetujuan absensi")} className={control} value={filters.review} onChange={e=>filter('review',e.target.value)}><option value="">{translateUI("Semua keputusan")}</option>{['PENDING','APPROVED','REJECTED','NOT_REQUIRED'].map(s=><option key={s} value={s}>{reviewLabel(s)}</option>)}</select></label>
      <label className="text-xs text-slate-600">{translateUI("Sumber akun")}<select aria-label={translateUI("Sumber akun")} className={control} value={filters.source} onChange={e=>filter('source',e.target.value)}><option value="">{translateUI("Semua termasuk Guest")}</option><option value="registered">{translateUI("Crew terdaftar")}</option><option value="guest">{translateUI("Guest server")}</option><option value="local">{translateUI("Guest lokal")}</option></select></label>
      <label className="text-xs text-slate-600">{translateUI("Urutkan")}<select aria-label={translateUI("Urutkan absensi")} className={control} value={filters.sort} onChange={e=>filter('sort',e.target.value)}><option value="newest">{translateUI("Terbaru")}</option><option value="oldest">{translateUI("Terlama")}</option><option value="name">{translateUI("Nama A–Z")}</option><option value="status">{translateUI("Status A–Z")}</option></select></label>
    </div>
    <div className="flex gap-3 items-center text-xs text-slate-600"><button className={button} onClick={()=>filter('date',wibDate())}>{translateUI("Hari ini")}</button><button className={button} onClick={()=>setFilters({...emptyFilters})}>{translateUI("Reset filter")}</button><span>{filters.date||translateUI("Semua tanggal")} • {filtered.length}{" " + translateUI("catatan")}</span></div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-max text-sm"><thead className="text-xs bg-slate-50 text-slate-600"><tr>{['Nama & Kontak','Perusahaan','Jabatan','Jenis Penugasan','Lokasi','Tanggal','Jadwal','Clock In','Status','Telat','Clock Out','Lembur','Persetujuan Absensi','Persetujuan Lembur','Aksi'].map(h=><th key={h} className={`text-left p-3 whitespace-nowrap ${h==='Aksi'?'sticky right-0 bg-slate-50 z-10':''}`}>{translateUI(h)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(a=><tr key={a.source+':'+a.id}>
      <td className="p-3 min-w-44"><p className="font-semibold text-slate-900">{a.name}</p><p className="text-xs text-slate-500">{a.phone}</p>{a.source!=='registered'&&<p className="text-xs text-amber-700">{a.source==='local'?translateUI("Guest lokal belum sinkron"):'Guest'}</p>}</td>
      <td className="p-3 text-slate-700">{a.companyName || translateUI("Belum diisi")}</td><td className="p-3 text-slate-700">{a.jobTitle || translateUI("Belum diisi")}</td>
      <td className="p-3 whitespace-nowrap text-slate-700">{a.kind}</td><td className="p-3 min-w-40 text-slate-700">{a.location}</td><td className="p-3 text-slate-700">{a.date||'Tanggal belum terbaca'}</td><td className="p-3 min-w-36 text-slate-600">{scheduleLabel(a.schedule)}</td>
      <td className="p-3 min-w-36 text-slate-700">{translateUI(stamp(a.clockIn))}</td><td className="p-3 text-slate-700">{translateUI(a.status)}</td><td className="p-3 text-slate-700">{a.lateMinutes===null?translateUI("Belum dapat dihitung"):a.lateMinutes?`${a.lateMinutes} ${translateUI('menit')}`:'—'}</td>
      <td className="p-3 min-w-36 text-slate-700">{translateUI(stamp(a.clockOut))}</td><td className="p-3 min-w-28 text-slate-700">{a.overtimeMinutes===null?translateUI("Belum dihitung"):a.overtimeMinutes?`${a.overtimeMinutes} ${translateUI('menit')}`:'—'}</td>
      <td className="p-3"><ApprovalBadge value={a.source==='local'?'PENDING':a.review}/></td>
      <td className="p-3"><ApprovalBadge value={a.overtimeStatus}/></td>
      <td className="p-3 sticky right-0 bg-white"><div className="flex flex-col items-start gap-2">{needsReview(a)?<button disabled={busy||!!error} className={primary+' whitespace-nowrap'} onClick={()=>void open(a,true)}>{a.source==='local'?translateUI("Simpan & Tinjau"):a.review==='PENDING'?translateUI("Tinjau Absensi"):translateUI("Tinjau Lembur")}</button>:<span className="text-xs font-semibold text-emerald-700">{translateUI("Keputusan selesai")}</span>}<button disabled={busy} className="text-blue-700 text-xs font-semibold whitespace-nowrap" onClick={()=>void open(a)}>{translateUI("Lihat Detail")}</button><button disabled={busy} className="text-red-700 text-xs font-semibold" onClick={()=>{setDeleting(a);setDeleteReason('');setModalError('')}}>{translateUI("Hapus")}</button></div></td>
    </tr>)}</tbody></table></div>{!filtered.length&&<p className="text-sm text-slate-500 p-8 text-center">{loading?'Memuat absensi...':translateUI("Tidak ada absensi yang sesuai filter.")}</p>}</div>
    <Modal open={!!deleting} onClose={()=>{if(!busy)setDeleting(null)}} title={translateUI("Hapus Absensi")}>
      {deleting&&<div className="space-y-4"><p className="text-sm">{translateUI("Hapus absensi") + " "}{deleting.name}{" " + translateUI("pada") + " "}{deleting.date}{translateUI("? Catatan ini akan dikeluarkan dari rekap. Catatan lembur dan koreksi terkait ikut dihapus.")}</p><label className="block text-sm">{translateUI("Alasan penghapusan")}<textarea maxLength={1000} className={control+' mt-1'} value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} /></label>{modalError&&<p role="alert" className="text-sm text-red-700">{modalError}</p>}<div className="flex justify-end gap-3"><button className={button} disabled={busy} onClick={()=>setDeleting(null)}>{translateUI("Batal")}</button><button className="rounded-xl bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy||!deleteReason.trim()} onClick={()=>void removeAttendance()}>{busy?translateUI("Menghapus…"):translateUI("Hapus Absensi")}</button></div></div>}
    </Modal>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title={translateUI("Detail Absensi")} size="lg">{detail&&<div className="space-y-4">{identity(detail)}<p className="text-sm text-slate-600">{translateUI("Jadwal:") + " "}{translateUI(scheduleLabel(detail.schedule))} • {detail.date||translateUI('Tanggal belum terbaca')}</p>{calculation(detail)}{positions(detail)}{photos(detail)}<p className="text-sm text-slate-700 whitespace-pre-wrap">{translateUI("Catatan admin:") + " "}{detail.reviewNote||translateUI('Belum ada catatan.')}</p><p className="text-xs text-slate-500">{detail.timeSource==='LEGACY_DEVICE'?translateUI("Waktu berasal dari perangkat pada data lama. Bukan waktu server."):translateUI("Waktu penerimaan absensi berasal dari server.")}{" " + translateUI("Foto masuk dan pulang tidak dipasangkan otomatis berdasarkan nama/HP guest.")}</p></div>}</Modal>
    <Modal open={!!review} onClose={()=>{if(!busy)setReview(null);}} title={translateUI("Tinjau Pengajuan Absensi")} size="lg">{review&&<div className="space-y-4">{identity(review)}{positions(review)}{photos(review)}
      {modalError&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{modalError}</p>}
      {review.source==='local'?<><p className="text-sm text-slate-700">{translateUI("Data ini masih tersimpan di browser. Simpan foto dan catatannya ke server sebelum menyetujui atau menolak. Data asli di browser tetap dipertahankan.")}</p>{!review.clockIn&&!review.clockOut&&<label className="block text-sm text-slate-700">{translateUI("Tanggal dan jam sebenarnya (WIB)")}<input type="datetime-local" className={control} value={legacyDate} onChange={e=>setLegacyDate(e.target.value)}/></label>}<button disabled={busy} className={primary} onClick={()=>void importLegacy()}>{busy?translateUI("Menyimpan..."):translateUI("Simpan data lama ke server")}</button></>:
      <><label className="block text-sm text-slate-700">{translateUI("Yang ditinjau")}<select aria-label={translateUI("Yang ditinjau")} disabled={busy} className={control} value={target} onChange={e=>setTarget(e.target.value as 'attendance'|'overtime')}>{review.review==='PENDING'&&<option value="attendance">{translateUI("Pengajuan absensi")}</option>}{review.overtimeStatus==='PENDING'&&['APPROVED','NOT_REQUIRED'].includes(review.review)&&<option value="overtime">{translateUI("Lembur") + " "}{review.overtimeMinutes}{" " + translateUI("menit")}</option>}</select></label>
      <p className="text-xs text-slate-600">{translateUI("Persetujuan tidak mengubah status tepat waktu/telat dan tidak otomatis menghitung pembayaran.") + " "}{review.source==='guest'?translateUI("Guest belum terhubung ke jadwal crew, sehingga keterlambatan dan lembur belum dapat dinilai."):''}</p>
      <label className="block text-sm text-slate-700">{translateUI("Catatan admin (wajib jika menolak)")}<textarea aria-label={translateUI("Catatan admin")} rows={3} maxLength={2000} className={control} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div className="flex justify-end gap-3"><button disabled={busy} className={button.replace('text-slate-700','text-red-700')} onClick={()=>void resolve('REJECTED')}>{translateUI("Tolak Pengajuan")}</button><button disabled={busy} className={primary} onClick={()=>void resolve('APPROVED')}>{busy?translateUI("Menyimpan..."):translateUI("Setujui")}</button></div></>}
    </div>}</Modal>
  </div>;
}
