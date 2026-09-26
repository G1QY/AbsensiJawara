import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { api } from '../../lib/apiClient'
import { button, control, primary, message, type Crew, type Directory } from './adminData'

import {accountRoles as roles, roleDivisions} from '../../lib/accountRoles'
export default function CrewAccountControls({crew, directory, onSaved}: {crew:Crew; directory:Directory; onSaved:()=>Promise<void>}) {
  const {auth} = useAuth()
  const current = crew.user.user_roles?.[0]?.role.code || crew.crew_type
  const [editing,setEditing] = useState(false), [role,setRole] = useState(current === 'ADMIN_STORE' ? 'HEAD_STORE' : current)
  const [division,setDivision] = useState(crew.division || '')
  const scope = crew.user.head_store_scopes
  const city = (Array.isArray(scope) ? scope[0] : scope)?.city_name || ''
  const cities = [...new Map(directory.branches.filter(b=>b.city_name?.trim()).map(b=>[b.city_name!.trim().toLowerCase(), b])).values()]
  const [branchId,setBranchId] = useState(cities.find(b=>b.city_name!.trim().toLowerCase()===city.trim().toLowerCase())?.id || '')
  const [password,setPassword] = useState(''), [notice,setNotice] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const generation = useRef(0)
  useEffect(()=>{
    const hide=()=>{generation.current++;setPassword('')}
    const visibility=()=>{if(document.hidden)hide()}
    window.addEventListener('blur',hide);document.addEventListener('visibilitychange',visibility)
    return ()=>{generation.current++;window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility)}
  },[])
  useEffect(()=>{if(!password)return;const timer=setTimeout(()=>setPassword(''),30000);return()=>clearTimeout(timer)},[password])
  if(auth?.role!=='SUPER_ADMIN')return null
  async function reveal() {
    if(password){setPassword('');return}
    const request=++generation.current
    setBusy(true);setError('');setNotice('')
    try {
      const data=await api.post<{available:boolean;password?:string;message?:string}>(`/crew/${crew.id}/reveal-password`)
      if(request===generation.current){setPassword(data.available ? data.password || '' : '');setNotice(data.message || '')}
    } catch(e){if(request===generation.current)setError(message(e))} finally{setBusy(false)}
  }
  async function save() {
    setBusy(true);setError('');setPassword('')
    try {await api.patch(`/accounts/${crew.user.id}/role`,{role,branchId,division:roleDivisions(role).length ? division : ''});setEditing(false);setNotice('Role tersimpan. Pengguna perlu masuk kembali untuk memperbarui menu.');await onSaved()}
    catch(e){setError(message(e))}finally{setBusy(false)}
  }
  return <section className="rounded-xl border border-slate-200 p-4 space-y-3">
    <h4 className="font-semibold text-sm">Akun & Hak Akses</h4>
    <p className="text-sm">Role akun: {roles[current] || current}{crew.division ? ` · ${crew.division}` : ''}{city && ['HEAD_STORE','ADMIN_STORE'].includes(current) ? ` · ${city}` : ''}</p>
    <button className={button} disabled={busy || auth.user.id===crew.user.id} onClick={()=>{setEditing(!editing);setPassword('');setError('')}}>Ubah role</button>
    {editing && <form className="space-y-3" onSubmit={e=>{e.preventDefault();void save()}}>
      <label className="block text-sm">Role akun<select aria-label="Role akun" className={control} value={role} onChange={e=>{setRole(e.target.value);if(!roleDivisions(e.target.value).includes(division))setDivision('')}}>{Object.entries(roles).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
      {role==='HEAD_STORE' && <label className="block text-sm">Kota cakupan<select aria-label="Kota cakupan" required className={control} value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Pilih kota</option>{cities.map(b=><option key={b.id} value={b.id}>{b.city_name}</option>)}</select></label>}
      {roleDivisions(role).length>0 && <label className="block text-sm">Divisi<select aria-label="Divisi" required className={control} value={division} onChange={e=>setDivision(e.target.value)}><option value="">Pilih divisi</option>{roleDivisions(role).map(d=><option key={d}>{d}</option>)}</select></label>}
      <p className="text-xs text-slate-600">{role==='SUPER_ADMIN' ? 'Super Admin mendapat akses penuh, termasuk melihat password yang tersedia.' : role.startsWith('CREW_') ? 'Mengganti jenis crew mengakhiri penugasan jenis sebelumnya.' : 'Atur lokasi kerja dan jadwal melalui Kelola Crew. Divisi adalah label profil.'}</p>
      <button className={primary} disabled={busy}>Simpan role</button>
    </form>}
    {current!=='SUPER_ADMIN' && <div className="space-y-2">
      <label className="block text-sm">Password akun<input aria-label="Password akun" readOnly autoComplete="off" type="text" className={control} value={password || '••••••••'} /></label>
      <button className={button} disabled={busy} onClick={()=>void reveal()}>{password ? 'Sembunyikan password' : 'Tampilkan password'}</button>
      <p className="text-xs text-slate-500">Hanya Super Admin. Akses dicatat. Password disembunyikan setelah 30 detik atau saat meninggalkan jendela.</p>
    </div>}
    {notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>
}
