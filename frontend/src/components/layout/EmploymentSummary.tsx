import {t as translateUI} from '../../lib/i18n';
import {useEffect, useState} from 'react';
import {useAuth} from '../../lib/AuthContext';
export default function EmploymentSummary(){
 const {auth,refreshProfile}=useAuth(); const [error,setError]=useState('');
 useEffect(()=>{let active=true; const refresh=()=>void refreshProfile().then(()=>{if(active)setError('')}).catch(()=>{if(active)setError('Informasi pekerjaan belum dapat diperbarui.')});refresh();window.addEventListener('focus',refresh);return()=>{active=false;window.removeEventListener('focus',refresh)}},[refreshProfile]);
 if(!auth||auth.role==='GUEST_CREW')return null;
 return <section aria-label={translateUI("Identitas pekerjaan")} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
  <div className="grid gap-2 sm:grid-cols-3"><div><span className="block text-xs text-slate-500">{translateUI("Perusahaan")}</span>{auth.user.company_name||translateUI("Belum ditetapkan")}</div><div><span className="block text-xs text-slate-500">{translateUI("Jabatan")}</span>{auth.user.job_title||translateUI("Belum ditetapkan")}</div><div><span className="block text-xs text-slate-500">{translateUI("Cabang")}</span>{auth.user.branch_name||translateUI("Belum ditetapkan")}</div></div>
  {error&&<p role="status" className="mt-2 text-xs text-amber-700">{translateUI(error)}</p>}
 </section>;
}
