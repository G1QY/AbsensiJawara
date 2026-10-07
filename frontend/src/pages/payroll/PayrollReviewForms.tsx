import {useState} from 'react';
import {api} from '../../lib/apiClient';
import {button,control,message,money,primary} from '../admin/adminData';
import {PolicyForm,RupiahInput} from './PayrollComponents';
import {basisLabel,type Adjustment,type PayrollEntry,type PayrollPolicy,type PayrollWorkspaceData,type PayrollYearPreview,payrollDate,payrollMonth} from './payrollApi';

function Impact({before,after}:{before:PayrollEntry[];after:PayrollEntry[]}) {
  const total=(rows:PayrollEntry[])=>rows.reduce((n,r)=>n+r.total,0);
  const previous=new Map(before.map(r=>[r.key,r]));
  return <section aria-label="Pratinjau perhitungan" className="space-y-3">
    <div className="grid grid-cols-2 gap-3 rounded-xl bg-blue-50 p-4 text-sm">
      <div>Sebelum<strong className="block mt-1 break-words">{money(total(before))}</strong></div>
      <div>Sesudah<strong className="block mt-1 text-blue-800 break-words">{money(total(after))}</strong></div>
    </div>
    <p className="text-xs text-slate-600">{after.length} draft · perubahan {money(total(after)-total(before))}. Nilai dihitung dari data saat pratinjau dibuka.</p>
    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
      {after.map(r=><div key={r.key} className="p-3 text-sm space-y-1">
        <p className="font-semibold">{r.person.full_name}{r.event?' · '+r.event.name:''}</p>
        <p className="text-xs text-slate-500">{basisLabel(r.basis)} · {r.units} × {money(r.baseRate)}</p>
        <p className="flex flex-wrap gap-2"><span className="text-slate-500">{money(previous.get(r.key)?.total||0)}</span><span aria-hidden="true">→</span><strong>{money(r.total)}</strong></p>
      </div>)}
    </div>
  </section>;
}

export function PolicyReview({data,busy,onSave}:{data:PayrollWorkspaceData;busy:boolean;onSave:(payload:{year:number;fromMonth:number;policy:PayrollPolicy;revision:string})=>void}) {
  const [year,setYear]=useState(Number(data.month.slice(0,4))),[fromMonth,setFromMonth]=useState(Number(data.month.slice(5)));
  const [draft,setDraft]=useState<PayrollPolicy>({...data.policy,cutoff_day:data.policy.cutoff_day??31,payment_day:data.policy.payment_day??1,payment_month_offset:data.policy.payment_month_offset??1});
  const [preview,setPreview]=useState<PayrollYearPreview|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[ack,setAck]=useState(false);
  if(!preview) return <div className="space-y-4">
    <p className="text-sm text-slate-600">Simpan sekali untuk bulan mulai yang dipilih sampai Desember. Slip tetap dibuat per bulan; slip final/dibayar mempertahankan rincian yang sudah dikunci.</p>
    <fieldset disabled={busy||loading} className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">Tahun aturan<input aria-label="Tahun aturan" className={control+' mt-1'} type="number" min={2000} max={2099} step={1} value={year} onChange={e=>{setYear(Number(e.target.value));setFromMonth(1)}}/></label>
      <label className="text-sm">Mulai berlaku<select aria-label="Mulai berlaku" className={control+' mt-1'} value={fromMonth} onChange={e=>setFromMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Intl.DateTimeFormat('id-ID',{month:'long'}).format(new Date(2020,i,1))}</option>)}</select></label>
    </fieldset>
    {error&&<p role="alert" className="ui-error p-3 rounded-xl">{error}</p>}
    <PolicyForm policy={draft} busy={busy||loading} submitLabel={loading?'Menghitung...':'Pratinjau aturan tahunan'} onSave={async p=>{
      setDraft(p);setLoading(true);setError('');setAck(false);
      try {setPreview(await api.post<PayrollYearPreview>('/payroll/year-preview',{year,fromMonth,policy:p}));} catch(e){setError(message(e));} finally {setLoading(false);}
    }}/>
  </div>;
  return <div className="space-y-4">
    <h3 className="font-semibold">Tinjau aturan tahun {preview.year}</h3>
    <p className="text-sm text-slate-600">Berlaku mulai {payrollMonth(`${preview.year}-${String(preview.fromMonth).padStart(2,'0')}`)} sampai Desember. Nominal adalah perhitungan draft berdasarkan data saat ini, bukan proyeksi kehadiran setahun penuh.</p>
    <div className="max-h-80 overflow-y-auto space-y-3" aria-label="Kalender pembayaran tahunan">
      {preview.months.map(m=><article key={m.month} className="border border-slate-200 rounded-xl p-3 text-sm space-y-2">
        <h4 className="font-semibold">{payrollMonth(m.month)}{!m.affected?' · batas tahun berikutnya':''}</h4>
        <p>Perhitungan: <strong>{payrollDate(m.afterCalendar.startDate)} – {payrollDate(m.afterCalendar.endDate)}</strong></p>
        {(m.beforeCalendar.startDate!==m.afterCalendar.startDate||m.beforeCalendar.endDate!==m.afterCalendar.endDate)&&<p className="text-xs text-slate-500">Sebelumnya {payrollDate(m.beforeCalendar.startDate)} – {payrollDate(m.beforeCalendar.endDate)}</p>}
        <p>Rencana bayar: <strong>{payrollDate(m.afterCalendar.paymentDate)}</strong></p>
        <p>{m.drafts} draft: {money(m.beforeTotal)} → <strong>{money(m.afterTotal)}</strong></p>
        <p className="text-xs text-slate-500">{m.locked} slip final/dibayar tetap. {!m.affected?'Aturan tarif bulan ini tidak diubah; hanya awal periode mengikuti akhir Desember.':''}</p>
      </article>)}
    </div>
    {preview.issues.length>0&&<div role="alert" className="ui-error p-3 rounded-xl text-sm space-y-2">{preview.issues.map(issue=><p key={issue}>{issue}</p>)}</div>}
    {(preview.basisChanged||preview.datesChanged)&&<label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" className="mt-1" checked={ack} onChange={e=>setAck(e.target.checked)}/><span>Saya sudah memeriksa rentang tanggal dan satuan tarif. Nominal tarif tidak dikonversi otomatis saat dasar gaji berubah; gaji bulanan tidak diprorata otomatis ketika rentang transisi berubah.</span></label>}
    <div className="flex flex-wrap gap-2"><button disabled={busy||!!preview.issues.length||(preview.basisChanged||preview.datesChanged)&&!ack} className={primary+' flex-1 min-h-11'} onClick={()=>onSave({year,fromMonth,policy:draft,revision:preview.revision})}>{busy?'Menyimpan...':'Simpan aturan tahunan'}</button><button disabled={busy} className={button} onClick={()=>setPreview(null)}>Ubah aturan</button></div>
  </div>;
}

export default function PayrollBatchForm({data,rows,busy,onSave}:{data:PayrollWorkspaceData;rows:PayrollEntry[];busy:boolean;onSave:(keys:string[],patch:Partial<Adjustment>)=>void}) {
  const [selected,setSelected]=useState<string[]>([]),[field,setField]=useState<'allowance'|'deduction'|'rate_override'>('allowance'),[value,setValue]=useState(''),[note,setNote]=useState('');
  const [preview,setPreview]=useState<PayrollWorkspaceData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const picked=rows.filter(r=>selected.includes(r.key));
  const patch={ [field]: Number(value), note };
  const labels={allowance:'Tunjangan / tambahan (Rp)',deduction:'Potongan manual (Rp)',rate_override:'Tarif dasar pengganti (Rp)'};
  if(preview) return <div className="space-y-4">
    <h3 className="font-semibold">Tinjau {picked.length} draft terpilih</h3>
    <p className="text-sm">{labels[field]}: <strong>{money(Number(value))}</strong>. Nominal ini mengganti komponen lama pada setiap slip.</p>
    <Impact before={picked} after={preview.rows}/>
    <p className="text-sm text-slate-600 break-words">Catatan: {note}</p>
    <div className="flex flex-wrap gap-2"><button className={primary+' flex-1 min-h-11'} disabled={busy} onClick={()=>onSave(selected,patch)}>{busy?'Menyimpan...':`Simpan ${picked.length} penyesuaian`}</button><button className={button} disabled={busy} onClick={()=>setPreview(null)}>Kembali</button></div>
  </div>;
  return <form className="space-y-4" onSubmit={async e=>{
    e.preventDefault();setError('');setLoading(true);
    try {setPreview(await api.post<PayrollWorkspaceData>('/payroll/batch-adjustments',{month:data.month,revision:data.revision,keys:selected,patch,preview:true}));} catch(e){setError(message(e));} finally{setLoading(false);}
  }}><fieldset disabled={busy||loading} className="space-y-4">
    <p className="text-sm text-slate-600">Pilih draft dari hasil filter. Ubah satu komponen sekaligus; komponen lain tetap mengikuti pengaturan masing-masing crew.</p>
    <label className="flex items-center gap-3 min-h-11 text-sm font-semibold"><input type="checkbox" checked={rows.length>0&&selected.length===rows.length} onChange={e=>setSelected(e.target.checked?rows.map(r=>r.key):[])}/>Pilih semua {rows.length} draft</label>
    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">{rows.map(r=><label key={r.key} className="flex items-start gap-3 p-3 text-sm"><input type="checkbox" className="mt-1" checked={selected.includes(r.key)} onChange={e=>setSelected(old=>e.target.checked?[...old,r.key]:old.filter(k=>k!==r.key))}/><span className="min-w-0"><strong>{r.person.full_name}</strong>{r.event?' · '+r.event.name:''}<small className="block mt-1 text-slate-500">{basisLabel(r.basis)} · bersih {money(r.total)}</small></span></label>)}</div>
    <label className="block text-sm">Komponen yang diubah<select className={control+' mt-1'} value={field} onChange={e=>setField(e.target.value as typeof field)}><option value="allowance">Tunjangan / tambahan</option><option value="deduction">Potongan manual</option><option value="rate_override">Tarif dasar</option></select></label>
    <RupiahInput label={labels[field]} value={value} onChange={setValue}/>
    <p className="text-xs text-slate-600">Nominal mengganti nilai lama, bukan ditambahkan. Isi 0 untuk meniadakan komponen. {field==='rate_override'?'Periksa satuan masing-masing crew: tarif per bulan, hari hadir, atau event.':''}</p>
    <label className="block text-sm">Catatan penyesuaian massal<textarea required maxLength={1000} className={control+' mt-1 !rounded-xl min-h-20'} value={note} onChange={e=>setNote(e.target.value)}/></label>
    {error&&<p role="alert" className="ui-error p-3 rounded-xl">{error}</p>}
    <button disabled={!selected.length||selected.length>500||value===''||!note.trim()} className={primary+' w-full min-h-11'}>{loading?'Menghitung...':`Pratinjau ${selected.length} draft`}</button>
  </fieldset></form>;
}
