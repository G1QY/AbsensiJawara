import {t as translateUI} from '../../lib/i18n';
import {useState,type ReactNode} from 'react';
import {panel} from './adminData';
export function DataTable({headers,rows}:{headers:string[];rows:ReactNode[][]}) {
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="text-xs bg-slate-50 text-slate-500"><tr>{headers.map(h=><th key={h} className="text-left p-4 whitespace-nowrap">{translateUI(h)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j} className="p-4 text-slate-700">{v}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="p-8 text-sm text-slate-500 text-center">{translateUI("Belum ada data yang sesuai.")}</p>}</div>;
}
export function MiniChart({title,subtitle,points,color='#1554df',format=String}:{title:string;subtitle?:string;points:{label:string;value:number;details?:string[]}[];color?:string;format?:(n:number)=>string}) {
  const [selected,setSelected]=useState<string|null>(null);
  const max=Math.max(1,...points.map(p=>p.value));
  const point=points.find(p=>p.label===selected);
  return <section className={panel}><h3 className="text-sm font-semibold text-slate-900">{translateUI(title)}</h3>{subtitle&&<p className="text-xs text-slate-500 mt-1">{translateUI(subtitle)}</p>}
    <div className="flex gap-3 items-end h-44 mt-5" role="group" aria-label={title}>{points.map(p=><button type="button" key={p.label} onClick={()=>setSelected(selected===p.label?null:p.label)} aria-pressed={selected===p.label} aria-label={`${title}, ${p.label}: ${format(p.value)}`} className="flex flex-col justify-end items-center h-full flex-1 min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600 hover:bg-slate-50"><span className="text-[10px] text-slate-600 mb-2 truncate max-w-full">{format(p.value)}</span><span className="w-full max-w-9 rounded-t-md" style={{height:`${p.value/max*105}px`,minHeight:p.value?3:0,background:color}}/><span className="text-[10px] text-slate-500 mt-2">{translateUI(/^\d{4}-\d{2}-\d{2}$/.test(p.label)?p.label.slice(5):/^\d{4}-\d{2}$/.test(p.label)?`${p.label.slice(5)}/${p.label.slice(2,4)}`:p.label)}</span></button>)}</div>
    {point&&<div role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">{point.label}: {format(point.value)}</p>{point.details?.length?<ul className="mt-2 max-h-48 overflow-y-auto space-y-1">{point.details.map((detail,i)=><li key={i} className="break-words text-xs text-slate-600">{detail}</li>)}</ul>:<p className="text-xs text-slate-500 mt-1">Belum ada data pada periode ini.</p>}</div>}
  </section>;
}
export function Stat({label,value,sub,tone='blue'}:{label:string;value:ReactNode;sub?:string;tone?:'blue'|'green'|'red'|'plain'}){
 const styles={blue:'bg-blue-600 text-white',green:'bg-emerald-50 text-emerald-800',red:'bg-red-50 text-red-700',plain:'bg-white text-slate-900 border border-slate-200'};
 return <div className={'p-5 rounded-2xl '+styles[tone]}><p className="text-xs">{translateUI(label)}</p><p className="text-xl font-bold mt-2 break-words">{value}</p>{sub&&<p className="text-xs mt-1">{translateUI(sub)}</p>}</div>;
}
export const eventStatus=(s:string)=>({DRAFT:'Draft',SCHEDULED:'Scheduled',ONGOING:'Ongoing',COMPLETED:'Completed',CANCELLED:'Cancelled'}[s]||s);
export function EventBadge({status}:{status:string}){return <span className={'text-xs px-2 py-1 rounded-full whitespace-nowrap '+(status==='ONGOING'?'bg-blue-600 text-white':status==='COMPLETED'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-700')}>{eventStatus(status)}</span>;}
