import { useEffect, useMemo, useState } from 'react';
import ExportButtons from '../../components/ui/ExportButtons';
import CameraPhotoUpload from '../../components/attendance/CameraPhotoUpload';
import { api } from '../../lib/apiClient';
import { CrewEventAssignment, idDate, useCrewEventWorkspace } from './crewEventWorkspace';

type Item = { nama:string; jumlah:number; kategori:string; kondisi:string; alasan?:string; foto?:string; foto_after?:string; fotoUrl?:string };
const initialItem = (): Item => ({ nama:'', jumlah:1, kategori:'Electronic', kondisi:'Baik', alasan:'' });
const cleanItems = (value:unknown):Item[] => Array.isArray(value) ? value.map((item:any)=>({ ...initialItem(), ...item, jumlah:Number(item.jumlah)||0 })) : [];

export default function CeInventory() {
  const { data, loading, error, reload } = useCrewEventWorkspace();
  const rows = useMemo(()=>[...(data?.assignments||[])].sort((a,b)=>b.event.event_date.localeCompare(a.event.event_date)),[data]);
  const [eventId,setEventId]=useState('');
  const row=rows.find(item=>item.event.id===eventId)||rows.find(item=>(item.workflow.data.inventory_before_items||[]).length)||rows[0];
  const [before,setBefore]=useState<Item[]>([]);
  const [after,setAfter]=useState<Item[]>([]);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{if(!row)return;setEventId(row.event.id);const start=cleanItems(row.workflow.data.inventory_before_items);setBefore(start);const end=cleanItems(row.workflow.data.inventory_after_items);setAfter(start.map((item,index)=>({...item,...(end[index]||{}),jumlah:end[index]?.jumlah??item.jumlah,kondisi:end[index]?.kondisi||item.kondisi})));},[row?.event.id,row?.workflow.updated_at]);

  if(loading)return <State text="Memuat inventory event…"/>;
  if(error)return <State text={error} error/>;
  if(!row)return <State text="Belum ada event yang ditugaskan."/>;

  const items=before.map((item,index)=>{const end=after[index]||item;const selisih=(Number(end.jumlah)||0)-(Number(item.jumlah)||0);return{...item,after:end.jumlah,afterCondition:end.kondisi,alasan:end.alasan||'',selisih};});
  const problem=items.filter(item=>item.selisih!==0||item.afterCondition!=='Baik');
  const updateBefore=(index:number,patch:Partial<Item>)=>setBefore(current=>current.map((item,i)=>i===index?{...item,...patch}:item));
  const updateAfter=(index:number,patch:Partial<Item>)=>setAfter(current=>current.map((item,i)=>i===index?{...item,...patch}:item));
  const addItem=()=>{setBefore(current=>[...current,initialItem()]);setAfter(current=>[...current,initialItem()]);};
  const removeItem=(index:number)=>{setBefore(current=>current.filter((_,i)=>i!==index));setAfter(current=>current.filter((_,i)=>i!==index));};
  const save=async()=>{if(before.some(item=>!item.nama.trim())){setMessage('Nama barang wajib diisi.');return}setSaving(true);setMessage('');try{await api.put(`/crew-event/events/${row.event.id}/workflow`,{data:{...row.workflow.data,inventory_before_items:before.map(({fotoUrl,...item})=>item),inventory_after_items:after.map(({fotoUrl,...item})=>item)},expectedUpdatedAt:row.workflow.updated_at || null,currentStep:row.workflow.current_step,maxReached:row.workflow.max_reached});setEditing(false);setMessage('Inventory tersimpan dan diperbarui untuk seluruh anggota.');reload();}catch(reason){setMessage(reason instanceof Error?reason.message:'Inventory gagal disimpan.')}finally{setSaving(false)}};

  return <div className="p-4 sm:p-6 space-y-4">
    <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><InventoryIcon/></div>
      <div className="min-w-0 flex-1"><h1 className="font-semibold text-slate-900">{row.event.event_name}</h1><p className="text-xs text-slate-500 mt-1">{row.event.event_code} • {idDate(row.event.event_date)}</p></div>
      {rows.length>1&&<select value={eventId} onChange={event=>setEventId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">{rows.map(item=><option key={item.event.id} value={item.event.id}>{item.event.event_name}</option>)}</select>}
      <button onClick={()=>{setEditing(value=>!value);setMessage('')}} className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">{editing?'Batal':'Edit Inventory'}</button>
    </section>
    {message&&<p className={`rounded-xl border px-4 py-3 text-sm ${message.includes('tersimpan')?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-red-200 bg-red-50 text-red-700'}`}>{message}</p>}
    <div className="grid sm:grid-cols-3 gap-3"><Stat label="Total Item" value={items.length} color="blue"/><Stat label="Item Sesuai" value={items.filter(item=>item.selisih===0&&item.afterCondition==='Baik').length} color="green"/><Stat label="Selisih atau Masalah" value={problem.length} color="red"/></div>
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between gap-3"><h2 className="font-semibold text-sm">Inventory Sebelum dan Setelah Event</h2><ExportButtons filename={`Inventory-${row.event.event_code}`} title="Perbandingan Inventory Event" subtitle={row.event.event_name} headers={['Item','Kategori','Before','After','Selisih','Kondisi','Alasan']} rows={items.map(item=>[item.nama,item.kategori,item.jumlah,item.after,item.selisih,item.afterCondition,item.alasan])}/></div>
      {editing?<div className="p-4 space-y-4">{before.map((item,index)=><div key={index} className="rounded-2xl border border-slate-200 p-4 space-y-3"><div className="flex justify-between gap-3"><strong className="text-sm">Item {index+1}</strong><button onClick={()=>removeItem(index)} className="text-xs font-semibold text-red-600">Hapus</button></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3"><Field label="Nama Barang" value={item.nama} onChange={value=>updateBefore(index,{nama:value})}/><Field label="Kategori" value={item.kategori} onChange={value=>updateBefore(index,{kategori:value})}/><Field label="Jumlah Sebelum" type="number" value={item.jumlah} onChange={value=>updateBefore(index,{jumlah:Number(value)})}/><Field label="Jumlah Setelah" type="number" value={after[index]?.jumlah??item.jumlah} onChange={value=>updateAfter(index,{jumlah:Number(value)})}/><Select label="Kondisi Sebelum" value={item.kondisi} onChange={value=>updateBefore(index,{kondisi:value})}/><Select label="Kondisi Setelah" value={after[index]?.kondisi||'Baik'} onChange={value=>updateAfter(index,{kondisi:value})}/><Field label="Alasan Selisih" value={after[index]?.alasan||''} onChange={value=>updateAfter(index,{alasan:value})}/></div><div className="grid lg:grid-cols-2 gap-3"><CameraPhotoUpload eventId={row.event.id} value={item.foto} onChange={foto=>updateBefore(index,{foto})} fieldLabel="Foto Barang Sebelum Event" buttonLabel="Buka kamera"/><CameraPhotoUpload eventId={row.event.id} value={(after[index] as any)?.foto_after} onChange={foto_after=>updateAfter(index,{foto_after} as Partial<Item>)} fieldLabel="Foto Barang Setelah Event" buttonLabel="Buka kamera"/></div></div>)}<button onClick={addItem} className="w-full rounded-xl border border-dashed border-blue-300 py-3 text-sm font-semibold text-blue-700">Tambah Item</button><div className="flex justify-end"><button disabled={saving} onClick={save} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">{saving?'Menyimpan…':'Simpan Perubahan'}</button></div></div>:<div className="overflow-x-auto"><table className="employee-inventory-table w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Item','Kategori','Sebelum','Setelah','Selisih','Kondisi'].map(header=><th key={header} className="p-3 text-left whitespace-nowrap">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map((item,index)=><tr key={`${item.nama}-${index}`} className={item.selisih!==0?'bg-red-50/40':''}><td className="p-3"><div className="flex items-center gap-3"><ItemPhoto eventId={row.event.id} item={item}/><div><strong>{item.nama||'Tanpa nama'}</strong>{item.alasan&&<small className="block text-red-600">{item.alasan}</small>}</div></div></td><td className="p-3">{item.kategori}</td><td className="p-3 font-mono">{item.jumlah}</td><td className="p-3 font-mono">{item.after}</td><td className="p-3 font-mono">{item.selisih===0?'Sesuai':item.selisih}</td><td className="p-3">{item.afterCondition}</td></tr>)}{!items.length&&<tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada item. Klik Edit Inventory untuk menambahkan.</td></tr>}</tbody></table></div>}
    </section>
  </div>;
}

function ItemPhoto({eventId,item}:{eventId:string;item:Item}){const[url,setUrl]=useState(item.fotoUrl||'');useEffect(()=>{let active=true;if(!item.foto||item.fotoUrl)return;api.get<{url:string}>(`/crew-event/events/${eventId}/photos/url?key=${encodeURIComponent(item.foto)}`).then(result=>{if(active)setUrl(result.url)}).catch(()=>{});return()=>{active=false}},[eventId,item.foto,item.fotoUrl]);return url?<img src={url} alt={`Foto ${item.nama||'item'}`} className="w-12 h-12 rounded-xl object-cover border border-slate-200"/>:<div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center"><InventoryIcon/></div>}
function InventoryIcon(){return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>}
function Field({label,value,onChange,type='text'}:{label:string;value:string|number;onChange:(value:string)=>void;type?:string}){return <label className="block text-sm text-slate-600">{label}<input type={type} min={type==='number'?0:undefined} value={value} onChange={event=>onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"/></label>}
function Select({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){return <label className="block text-sm text-slate-600">{label}<select value={value} onChange={event=>onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900"><option>Baik</option><option>Rusak Ringan</option><option>Rusak Berat</option></select></label>}
function Stat({label,value,color}:{label:string;value:number;color:string}){const cls=color==='green'?'bg-emerald-50 text-emerald-700':color==='red'?'bg-red-50 text-red-700':'bg-blue-50 text-blue-700';return <div className={`rounded-2xl p-4 ${cls}`}><p className="text-xs">{label}</p><strong className="block text-xl mt-1">{value}</strong></div>}
function State({text,error=false}:{text:string;error?:boolean}){return <div className="p-6"><p className={`rounded-2xl border p-5 text-sm ${error?'border-red-200 bg-red-50 text-red-700':'border-slate-200 bg-white text-slate-600'}`}>{text}</p></div>}
