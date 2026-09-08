import { useEffect, useState } from 'react';
export default function Avatar({ name, src, large = false }: { name: string; src?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'G';
  return <span className={`inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full bg-blue-700 text-white font-bold ${large ? 'w-24 h-24 text-2xl' : 'w-9 h-9 text-xs'}`}>
    {src && !failed ? <img src={src} alt={`Foto profil ${name}`} onError={() => setFailed(true)} className="w-full h-full object-cover" /> : initials}
  </span>;
}
