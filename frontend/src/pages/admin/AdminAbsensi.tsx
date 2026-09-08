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
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{label}</span>;
}
export default function AdminAbsensi() {
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
      const legacy=getGuestAttendances().filter(g=>!data.guest.some(s=>s.id===g.serverId||(s.legacy_id===g.id&&s.phone===g.hp&&s.full_name===g.nama)));
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
  async function importLegacy() {
    if(!review?.legacy)return;setBusy(true);setModalError('');
    try {
      const g=review.legacy;const occurredAt=review.clockIn||review.clockOut||(legacyDate?new Date(legacyDate+':00+07:00').toISOString():'');
      if(!occurredAt)throw new Error('Tanggal data lama belum terbaca. Isi tanggal dan jam sebenarnya (WIB).');
      if(!/^data:image\/(jpeg|png|webp);base64,/.test(g.foto))throw new Error('Foto data lama tidak tersedia atau tidak didukung.');
      const photo=await (await fetch(g.foto)).blob();const form=new FormData();
      for(const [key,value]of Object.entries({fullName:g.nama,phone:g.hp,crewType:g.jenis==='Crew Store'?'CREW_STORE':'CREW_EVENT',locationName:g.lokasi,position:g.posisi||'',clockType:g.tipe==='Clock In'?'IN':'OUT',occurredAt,legacyId:g.id,note:g.catatan||'',latitude:g.latitude??'',longitude:g.longitude??'',accuracy:g.accuracy??'',address:g.address||''}))form.append(key,String(value));
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
  function photos(a:AttendanceRow) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(['in','out'] as const).map(side=>{
      const photo=side==='in'?a.inPhoto:a.outPhoto,time=side==='in'?a.clockIn:a.clockOut,comment=side==='in'?a.inNote:a.outNote;
      return <section key={side} className="p-4 rounded-xl bg-slate-50 space-y-3">
        <h3 className="font-semibold text-sm text-slate-900">{side==='in'?'Clock In':'Clock Out'}</h3>
        {photo?<img src={photo} alt={side==='in'?'Foto Clock In':'Foto Clock Out'} className="w-full rounded-xl object-contain max-h-80" onError={e=>{e.currentTarget.hidden=true;e.currentTarget.insertAdjacentText('afterend','Foto gagal dimuat. Tutup dan buka ulang detail.');}}/>:<p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl p-5">{time?'Foto tidak tersedia untuk catatan ini.':`Belum ada foto ${side==='in'?'Clock In':'Clock Out'}.`}</p>}
        <p className="text-sm font-semibold text-slate-900">{stamp(time)}</p>
        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words"><p className="font-semibold">Catatan {side==='in'?'Clock In':'Clock Out'}</p><p>{comment||'Tidak ada catatan.'}</p></div>
      </section>;
    })}</div>;
  }
  function identity(a:AttendanceRow){return <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl"><Avatar name={a.name}/><div><h3 className="font-semibold text-slate-900">{a.name}</h3><p className="text-sm text-slate-600">{a.kind} • {a.location}</p><p className="text-xs text-slate-500">{a.phone} {a.source!=='registered'?'• Guest':''}</p></div></div>;}
  function calculation(a:AttendanceRow){
    const rules=getPayrollRules(),lateHours=a.lateMinutes===null?null:Math.ceil(Math.max(0,a.lateMinutes)/60),overtimeHours=a.overtimeMinutes===null?null:Math.floor(Math.max(0,a.overtimeMinutes)/60);
    const deduction=lateHours===null?null:lateHours*rules.lateRate,approved=a.overtimeStatus==='APPROVED',bonus=overtimeHours===null?null:approved?overtimeHours*rules.overtimeRate:0;
    return <div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-blue-700">Status Clock In</p><p className="font-bold text-slate-900 mt-1">{a.status}</p><p className="text-xs text-slate-600 mt-1">{a.lateMinutes===null?'Tidak dapat dihitung tanpa jadwal':a.lateMinutes?`${a.lateMinutes} menit telat`:'Tepat waktu / lebih awal'}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs text-red-700">Potongan Telat</p><p className="font-bold text-red-700 mt-1">{deduction===null?'Belum dapat dihitung':'-'+money(deduction)}</p><p className="text-xs text-slate-600 mt-1">{lateHours===null?'Guest/tanpa jadwal':`${lateHours} jam × ${money(rules.lateRate)}`}</p></div><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs text-emerald-700">Bonus Lembur</p><p className="font-bold text-emerald-700 mt-1">{bonus===null?'Belum dapat dihitung':'+'+money(bonus)}</p><p className="text-xs text-slate-600 mt-1">{overtimeHours===null?'Belum Clock Out / tanpa jadwal':approved?`${overtimeHours} jam × ${money(rules.overtimeRate)}`:`${overtimeHours} jam • ${reviewLabel(a.overtimeStatus)}`}</p></div></div>;
  }
  return <div className="p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h2 className="font-bold text-lg text-slate-900">Rekap Absensi</h2><p className="text-sm text-slate-600">Kehadiran, catatan crew, dan persetujuan lembur.</p></div><div className="flex flex-wrap gap-2"><button className={button} disabled={loading||busy} onClick={()=>void load()}>Muat ulang</button><button className={primary} disabled={loading||!!error||!filtered.length} onClick={()=>{try{downloadWorkbook(recap(filtered),`Rekap-Absensi-${filters.date||'Semua-Tanggal'}-${wibDate()}.xlsx`);}catch(e){setError(message(e));}}}>Export Rekap ke Excel</button></div></div>
    {error&&<p role="alert" className="text-sm bg-red-50 text-red-700 rounded-xl p-4">{error} Data belum lengkap. Muat ulang sebelum mengekspor.</p>}
    {notice&&<p role="status" className="text-sm bg-emerald-50 text-emerald-700 rounded-xl p-4">{notice}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{metrics.map(([label,n])=><div key={label} className="rounded-xl p-4 bg-blue-50 text-blue-700"><p className="text-2xl font-bold">{loading?'...':n}</p><p className="text-xs mt-1">{label}</p></div>)}</div>
    <p className="text-xs text-slate-600">Ringkasan dan Excel mengikuti seluruh filter di bawah. Lembur memakai jam penuh setelah jadwal selesai dan hanya mendapat bonus setelah disetujui. Potongan/bonus memakai tarif simulasi payroll aktif.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
      <label className="text-xs text-slate-600">Cari crew<input aria-label="Cari crew" value={filters.search} onChange={e=>filter('search',e.target.value)} className={control} placeholder="Nama, HP, email, lokasi..."/></label>
      <label className="text-xs text-slate-600">Tanggal kerja (WIB)<input aria-label="Tanggal kerja" type="date" value={filters.date} onChange={e=>filter('date',e.target.value)} className={control}/></label>
      <label className="text-xs text-slate-600">Jenis<select aria-label="Jenis crew" className={control} value={filters.kind} onChange={e=>filter('kind',e.target.value)}><option value="">Semua jenis</option><option>Crew Event</option><option>Crew Store</option></select></label>
      <label className="text-xs text-slate-600">Status kehadiran<select aria-label="Status kehadiran" className={control} value={filters.status} onChange={e=>filter('status',e.target.value)}><option value="">Semua status</option>{[...new Set(rows.map(a=>a.status))].sort().map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="text-xs text-slate-600">Persetujuan absensi<select aria-label="Persetujuan absensi" className={control} value={filters.review} onChange={e=>filter('review',e.target.value)}><option value="">Semua keputusan</option>{['PENDING','APPROVED','REJECTED','NOT_REQUIRED'].map(s=><option key={s} value={s}>{reviewLabel(s)}</option>)}</select></label>
      <label className="text-xs text-slate-600">Sumber akun<select aria-label="Sumber akun" className={control} value={filters.source} onChange={e=>filter('source',e.target.value)}><option value="">Semua termasuk Guest</option><option value="registered">Crew terdaftar</option><option value="guest">Guest server</option><option value="local">Guest lokal</option></select></label>
      <label className="text-xs text-slate-600">Urutkan<select aria-label="Urutkan absensi" className={control} value={filters.sort} onChange={e=>filter('sort',e.target.value)}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="name">Nama A–Z</option><option value="status">Status A–Z</option></select></label>
    </div>
    <div className="flex gap-3 items-center text-xs text-slate-600"><button className={button} onClick={()=>filter('date',wibDate())}>Hari ini</button><button className={button} onClick={()=>setFilters({...emptyFilters})}>Reset filter</button><span>{filters.date||'Semua tanggal'} • {filtered.length} catatan</span></div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-max text-sm"><thead className="text-xs bg-slate-50 text-slate-600"><tr>{['Crew','Jenis','Event / Store','Tanggal','Jadwal','Clock In','Status','Telat','Clock Out','Lembur','Persetujuan Absensi','Persetujuan Lembur','Aksi'].map(h=><th key={h} className={`text-left p-3 whitespace-nowrap ${h==='Aksi'?'sticky right-0 bg-slate-50 z-10':''}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(a=><tr key={a.source+':'+a.id}>
      <td className="p-3 min-w-44"><p className="font-semibold text-slate-900">{a.name}</p><p className="text-xs text-slate-500">{a.phone}</p>{a.source!=='registered'&&<p className="text-xs text-amber-700">{a.source==='local'?'Guest lokal belum sinkron':'Guest'}</p>}</td>
      <td className="p-3 whitespace-nowrap text-slate-700">{a.kind}</td><td className="p-3 min-w-40 text-slate-700">{a.location}</td><td className="p-3 text-slate-700">{a.date||'Tanggal belum terbaca'}</td><td className="p-3 min-w-36 text-slate-600">{scheduleLabel(a.schedule)}</td>
      <td className="p-3 min-w-36 text-slate-700">{stamp(a.clockIn)}</td><td className="p-3 text-slate-700">{a.status}</td><td className="p-3 text-slate-700">{a.lateMinutes===null?'Belum dapat dihitung':`${a.lateMinutes} menit`}</td>
      <td className="p-3 min-w-36 text-slate-700">{stamp(a.clockOut)}</td><td className="p-3 min-w-28 text-slate-700">{a.overtimeMinutes===null?'Belum dihitung':`${a.overtimeMinutes} menit`}</td>
      <td className="p-3"><ApprovalBadge value={a.source==='local'?'PENDING':a.review}/></td>
      <td className="p-3"><ApprovalBadge value={a.overtimeStatus}/></td>
      <td className="p-3 sticky right-0 bg-white"><div className="flex flex-col items-start gap-2">{needsReview(a)?<button disabled={busy||!!error} className={primary+' whitespace-nowrap'} onClick={()=>void open(a,true)}>{a.source==='local'?'Simpan & Tinjau':a.review==='PENDING'?'Tinjau Absensi':'Tinjau Lembur'}</button>:<span className="text-xs font-semibold text-emerald-700">Keputusan selesai</span>}<button disabled={busy} className="text-blue-700 text-xs font-semibold whitespace-nowrap" onClick={()=>void open(a)}>Lihat Detail</button></div></td>
    </tr>)}</tbody></table></div>{!filtered.length&&<p className="text-sm text-slate-500 p-8 text-center">{loading?'Memuat absensi...':'Tidak ada absensi yang sesuai filter.'}</p>}</div>
    <Modal open={!!detail} onClose={()=>setDetail(null)} title="Detail Absensi" size="lg">{detail&&<div className="space-y-4">{identity(detail)}<p className="text-sm text-slate-600">Jadwal: {scheduleLabel(detail.schedule)} • {detail.date||'Tanggal belum terbaca'}</p>{calculation(detail)}{photos(detail)}<p className="text-sm text-slate-700 whitespace-pre-wrap">Catatan admin: {detail.reviewNote||'Belum ada catatan.'}</p><p className="text-xs text-slate-500">{detail.timeSource==='LEGACY_DEVICE'?'Waktu berasal dari perangkat pada data lama. Bukan waktu server.':'Waktu penerimaan absensi berasal dari server.'} Foto masuk dan pulang tidak dipasangkan otomatis berdasarkan nama/HP guest.</p></div>}</Modal>
    <Modal open={!!review} onClose={()=>{if(!busy)setReview(null);}} title="Tinjau Pengajuan Absensi" size="lg">{review&&<div className="space-y-4">{identity(review)}{photos(review)}
      {modalError&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{modalError}</p>}
      {review.source==='local'?<><p className="text-sm text-slate-700">Data ini masih tersimpan di browser. Simpan foto dan catatannya ke server sebelum menyetujui atau menolak. Data asli di browser tetap dipertahankan.</p>{!review.clockIn&&!review.clockOut&&<label className="block text-sm text-slate-700">Tanggal dan jam sebenarnya (WIB)<input type="datetime-local" className={control} value={legacyDate} onChange={e=>setLegacyDate(e.target.value)}/></label>}<button disabled={busy} className={primary} onClick={()=>void importLegacy()}>{busy?'Menyimpan...':'Simpan data lama ke server'}</button></>:
      <><label className="block text-sm text-slate-700">Yang ditinjau<select aria-label="Yang ditinjau" disabled={busy} className={control} value={target} onChange={e=>setTarget(e.target.value as 'attendance'|'overtime')}>{review.review==='PENDING'&&<option value="attendance">Pengajuan absensi</option>}{review.overtimeStatus==='PENDING'&&['APPROVED','NOT_REQUIRED'].includes(review.review)&&<option value="overtime">Lembur {review.overtimeMinutes} menit</option>}</select></label>
      <p className="text-xs text-slate-600">Persetujuan tidak mengubah status tepat waktu/telat dan tidak otomatis menghitung pembayaran. {review.source==='guest'?'Guest belum terhubung ke jadwal crew, sehingga keterlambatan dan lembur belum dapat dinilai.':''}</p>
      <label className="block text-sm text-slate-700">Catatan admin (wajib jika menolak)<textarea aria-label="Catatan admin" rows={3} maxLength={2000} className={control} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div className="flex justify-end gap-3"><button disabled={busy} className={button.replace('text-slate-700','text-red-700')} onClick={()=>void resolve('REJECTED')}>Tolak Pengajuan</button><button disabled={busy} className={primary} onClick={()=>void resolve('APPROVED')}>{busy?'Menyimpan...':'Setujui'}</button></div></>}
    </div>}</Modal>
  </div>;
}
