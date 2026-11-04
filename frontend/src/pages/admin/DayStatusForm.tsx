import { useState } from 'react';
import { api } from '../../lib/apiClient';
import { button, control, message, primary } from './adminData';

export default function DayStatusForm({crewId, date='', onSaved, onCancel}:{crewId:string;date?:string;onSaved:(notice:string)=>void;onCancel?:()=>void}) {
  const [form,setForm]=useState({startDate:date,endDate:date,type:'DAY_OFF',reason:''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  return <form className="space-y-4" onSubmit={async e=>{
    e.preventDefault();setBusy(true);setError('');
    try {
      const result=await api.post<{updated:number}>('/admin-store-schedules/day-status',{crewId,...form});
      onSaved(`${result.updated} tanggal diperbarui. ${form.type==='WORK'?'Jadwal shift sebelumnya aktif kembali. Tanggal tanpa shift perlu dibuatkan jadwal.':'Status hari tersimpan dan tidak dikenai potongan absen otomatis.'}`);
    } catch(e) {setError(message(e));} finally {setBusy(false);}
  }}>
    <fieldset disabled={busy} className="space-y-4">
      <legend className="font-semibold text-slate-900 mb-3">Atur status hari crew</legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[['DAY_OFF','Libur'],['PERMIT','Izin'],['SICK','Sakit'],['WORK','Aktifkan kerja']].map(([value,label])=><label key={value} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border p-2 text-sm cursor-pointer ${form.type===value?'border-blue-600 bg-blue-50 text-blue-800':'border-slate-200'}`}>
          <input type="radio" name="day-status" value={value} checked={form.type===value} onChange={()=>setForm({...form,type:value})}/>{label}
        </label>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Tanggal mulai<input required type="date" className={control+' mt-1'} value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,endDate:form.endDate<e.target.value?e.target.value:form.endDate})}/></label>
        <label className="text-sm">Tanggal selesai<input required type="date" min={form.startDate} className={control+' mt-1'} value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
      </div>
      <label className="block text-sm">Keterangan<textarea required minLength={3} maxLength={1000} className={control+' mt-1 !rounded-xl min-h-24'} placeholder="Contoh: libur mingguan atau izin keperluan keluarga" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 space-y-2">
        <p>{form.type==='WORK'?'Membatalkan libur/izin yang ditetapkan admin dan mengaktifkan shift yang sudah ada.':'Berlaku untuk semua tanggal dalam rentang, termasuk akhir pekan. Crew dibebaskan dari kewajiban hadir.'}</p>
        <p>Gaji bulanan tidak dipotong sebagai absen. Gaji harian/fee tetap berdasarkan kehadiran yang disetujui. Tanggal dengan absensi atau payroll final terkunci.</p>
      </div>
      {error&&<p role="alert" className="ui-error p-3 rounded-xl text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={primary+' flex-1 min-h-11'} disabled={busy||form.reason.trim().length<3}>{busy?'Menyimpan...':'Simpan status hari'}</button>
        {onCancel&&<button type="button" className={button} onClick={onCancel}>Batal</button>}
      </div>
    </fieldset>
  </form>;
}
