import {control} from '../../pages/admin/adminData'

const SHIFT_HOURS: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: '09:00', endTime: '18:00' },
  2: { startTime: '15:00', endTime: '19:00' },
  3: { startTime: '22:00', endTime: '06:00' }
};

export default function ShiftFields({shiftNumber,startTime,endTime,disabled=false,onChange}:{shiftNumber:number;startTime:string;endTime:string;disabled?:boolean;onChange:(patch:{shiftNumber?:number;startTime?:string;endTime?:string})=>void}) {
  const overnight=!!startTime&&!!endTime&&endTime<startTime
  return <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 sm:p-4 space-y-3 min-w-0">
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold mb-2">Shift kerja</legend>
      <div className="grid grid-cols-3 gap-2">{[1,2,3].map(number=><label key={number} className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600 ${shiftNumber===number?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white text-slate-700'}`}><input type="radio" className="absolute inset-0 opacity-0 cursor-pointer" name="shift-number" value={number} checked={shiftNumber===number} onChange={()=>onChange({shiftNumber:number, ...(SHIFT_HOURS[number] || {})})}/>Shift {number}</label>)}</div>
    </fieldset>
    <div className="grid grid-cols-2 gap-3 min-w-0">
      <label className="min-w-0 text-xs text-slate-600">Jam masuk<input aria-label="Jam masuk" disabled={disabled} required type="time" className={control+' min-w-0'} value={startTime} onChange={e=>onChange({startTime:e.target.value})}/></label>
      <label className="min-w-0 text-xs text-slate-600">Jam pulang<input aria-label="Jam pulang" disabled={disabled} required type="time" className={control+' min-w-0'} value={endTime} onChange={e=>onChange({endTime:e.target.value})}/></label>
    </div>
    <p className={`text-xs ${overnight?'text-blue-700 font-medium':'text-slate-500'}`}>{overnight?'Pulang pada hari berikutnya. Tanggal jadwal mengikuti hari masuk.':'Tentukan jam kerja untuk shift yang dipilih. Waktu dalam WIB.'}</p>
    {startTime&&startTime===endTime&&<p role="alert" className="text-xs text-red-700">Jam masuk dan pulang tidak boleh sama.</p>}
  </div>
}
