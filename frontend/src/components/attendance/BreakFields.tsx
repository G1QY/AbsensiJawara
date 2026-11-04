import { control } from '../../pages/admin/adminData';

export default function BreakFields({start,end,disabled,onChange}:{start:string;end:string;disabled?:boolean;onChange:(start:string,end:string)=>void}) {
  const enabled=!!(start||end);
  return <fieldset disabled={disabled} className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3 min-w-0">
    <legend className="px-1 text-sm font-semibold">Waktu istirahat</legend>
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={e=>onChange(e.target.checked?'12:00':'',e.target.checked?'13:00':'')}/>Aktifkan istirahat pada shift ini</label>
    {enabled&&<div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 text-xs">Mulai istirahat<input aria-label="Mulai istirahat" type="time" required className={control+' min-w-0'} value={start} onChange={e=>onChange(e.target.value,end)}/></label>
      <label className="min-w-0 text-xs">Selesai istirahat<input aria-label="Selesai istirahat" type="time" required className={control+' min-w-0'} value={end} onChange={e=>onChange(start,e.target.value)}/></label>
    </div>}
    <p className="text-xs text-slate-600">Satu rentang istirahat per jadwal Shift 1, 2, atau 3. Isi jam dalam WIB di antara jam masuk dan pulang, termasuk untuk shift malam. Crew mengambil foto dan GPS saat mulai serta selesai istirahat.</p>
  </fieldset>;
}
