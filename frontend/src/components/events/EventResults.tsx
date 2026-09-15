import { eventFinancials } from '../../lib/eventResultsData';
import { Fragment, useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import ExportButtons from '../ui/ExportButtons';
import { rupiah } from '../../pages/crewEvent/crewEventWorkspace';

type Data = Record<string, any>;
type Props = { eventId: string; data: Data; tab: 'Inventory' | 'Operasional'; admin?: boolean; eventName?: string; eventDate?: string; context?: Record<string, string> };

export function EventPhoto({ eventId, value, label, admin = false, compact = false }: { eventId: string; value?: string; label: string; admin?: boolean; compact?: boolean }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(''); setFailed(false);
    if (value) api.get<{ url: string }>(`${admin ? '/admin-events' : '/crew-event/events'}/${eventId}/photos/url?key=${encodeURIComponent(value)}`)
      .then(result => { if (active) setUrl(result.url); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [eventId, value, admin]);
  return <figure className={compact ? 'w-14 shrink-0' : 'min-w-0 rounded-xl bg-slate-50 p-3'}>
    {url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Buka ${label}`}><img src={url} alt={label} className={compact ? 'h-14 w-14 rounded-xl object-cover' : 'h-36 sm:h-44 w-full rounded-xl object-contain bg-slate-100'} /></a>
      : <div className={`${compact ? 'h-14 text-[10px]' : 'h-36 text-xs'} flex items-center justify-center rounded-xl bg-slate-100 p-2 text-center text-slate-500`}>{failed ? 'Foto gagal dimuat' : value ? 'Memuat foto…' : 'Belum ada foto'}</div>}
    {!compact && <figcaption className="mt-2 text-xs text-slate-600">{label}</figcaption>}
  </figure>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><h3 className="border-b border-slate-100 p-4 text-sm font-semibold">{title}</h3><div className="space-y-3 p-4">{children}</div></section>;
}
function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><span className={`text-right break-words ${strong ? 'font-semibold' : ''}`}>{value}</span></div>;
}
export default function EventResults({ eventId, data, tab, admin = false, eventName = 'Event', eventDate = '', context = {} }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => { setExpanded(null); }, [eventId]);
  const photo = (value: string | undefined, label: string, compact = false) => <EventPhoto eventId={eventId} value={value} label={label} admin={admin} compact={compact} />;
  const before: Data[] = Array.isArray(data.inventory_before_items) ? data.inventory_before_items : [];
  const after: Data[] = Array.isArray(data.inventory_after_items) ? data.inventory_after_items : [];
  const items = before.map((item, index) => ({ item, end: after[index], delta: after[index] ? Number(after[index].jumlah) - Number(item.jumlah) : null }));
  const issues = items.filter(({ end, delta }) => end && (delta !== 0 || end.kondisi !== 'Baik')).length;
  const matching = items.filter(({ end, delta }) => end && delta === 0 && end.kondisi === 'Baik').length;
  if (tab === 'Inventory') return <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Total Item', items.length], ['Item Sesuai', matching], ['Selisih / Masalah', issues], ['Belum diperiksa', items.filter(row => !row.end).length]].map(([label, count]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-xl">{count}</strong></div>)}</div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><h3 className="text-sm font-semibold">Inventory Sebelum dan Setelah Event</h3><ExportButtons context={context} filename={`Inventory-${eventName}`} title="Perbandingan Inventory Event" subtitle={eventName} headers={['Item', 'Kategori', 'Sebelum', 'Setelah', 'Selisih', 'Kondisi Sebelum', 'Kondisi Setelah', 'Alasan']} rows={items.map(({ item, end, delta }) => [item.nama, item.kategori, item.jumlah, end?.jumlah ?? 'Belum diisi', delta ?? 'Belum diperiksa', item.kondisi, end?.kondisi || 'Belum diisi', end?.alasan || ''])} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{['Item', 'Kategori', 'Sebelum', 'Setelah', 'Selisih', 'Kondisi', 'Bukti'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {items.map(({ item, end, delta }, index) => <Fragment key={index}><tr><td className="p-3"><div className="flex items-center gap-3">{photo(item.foto, `Foto ${item.nama}`, true)}<strong>{item.nama}</strong></div></td><td className="p-3">{item.kategori}</td><td className="p-3">{item.jumlah}</td><td className="p-3">{end?.jumlah ?? 'Belum diisi'}</td><td className="p-3">{delta === null ? 'Belum diperiksa' : delta === 0 ? 'Sesuai' : delta}</td><td className="p-3">{end?.kondisi || 'Belum diperiksa'}{end?.alasan && <p className="mt-1 text-xs text-slate-500">{end.alasan}</p>}</td><td className="p-3"><button className="text-blue-700 text-xs font-semibold" aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? null : index)}>{expanded === index ? 'Tutup' : 'Lihat foto'}</button></td></tr>{expanded === index && <tr><td colSpan={7} className="p-4"><div className="grid sm:grid-cols-2 gap-4">{photo(item.foto, 'Sebelum event')}{photo(end?.foto_after, 'Setelah event')}</div></td></tr>}</Fragment>)}
        {!items.length && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Inventory belum diisi melalui workflow Event Saya.</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
  const n = (key: string) => Number(data[key]) || 0;
  const {cash, revenue, transport, cost} = eventFinancials(data);
  const metrics = [['Tunai', rupiah(cash)], ['Transfer', rupiah(n('omset_transfer'))], ['Total Omset', rupiah(revenue)], ['Transportasi', rupiah(transport)], ['Biaya Kuota', rupiah(n('kuota_nominal'))], ['Pengeluaran Operasional', rupiah(cost)], ['Selisih', rupiah(revenue - cost)], ['Jumlah Kuota', `${n('kuota_gb')} GB`], ['Provider', data.kuota_provider || 'Belum diisi'], ['Catatan', data.kuota_catatan || '']];
  return <div className="space-y-4"><div className="flex justify-end"><ExportButtons context={context} filename={`Operasional-${eventName}`} title="Operasional Event" subtitle={eventName} headers={['Keterangan', 'Nilai']} rows={[...metrics, ...['pergi', 'pulang'].flatMap(dir => ['tanggal', 'jam', 'layanan', 'kendaraan', 'nominal'].map(key => [`Transportasi ${dir} ${key}`, String(data[`transportasi_${dir}_${key}`] ?? (key === 'tanggal' ? eventDate : 'Belum diisi'))]))]} /></div><div className="grid lg:grid-cols-2 gap-4">
    <Panel title="Transportasi">{(['pergi', 'pulang'] as const).map(dir => <div key={dir} className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">{photo(data[`transportasi_${dir}_photo`], `Bukti ${dir}`, true)}<div className="min-w-0 flex-1"><p className="text-xs font-semibold text-blue-700">{dir === 'pergi' ? 'PERGI' : 'PULANG'} {data[`transportasi_${dir}_jam`] || 'Jam belum diisi'}</p><p className="text-sm">{data[`transportasi_${dir}_layanan`] || 'Layanan belum diisi'}</p><p className="text-xs text-slate-500">{data[`transportasi_${dir}_kendaraan`] || 'Kendaraan belum diisi'} · {data[`transportasi_${dir}_tanggal`] || eventDate || 'Tanggal belum diisi'}</p></div><strong className="text-sm">{rupiah(n(`transportasi_${dir}_nominal`))}</strong></div>)}<Line label="Total Transportasi" value={rupiah(transport)} strong /></Panel>
    <Panel title="Cek Print"><div className="grid sm:grid-cols-2 gap-3">{photo(data.tes_print_before_photo || data.tes_print_photo, 'Sebelum Event')}{photo(data.tes_print_after_photo, 'Sesudah Event')}</div></Panel>
    <Panel title="Omset Event"><Line label="Tunai" value={rupiah(cash)} /><Line label="Transfer" value={rupiah(n('omset_transfer'))} />{photo(data.omset_nominal_photo, 'Bukti Omset')}<Line label="Total Omset" value={rupiah(revenue)} strong /><Line label="Pengeluaran Operasional" value={rupiah(cost)} /><Line label="Selisih" value={rupiah(revenue - cost)} strong /></Panel>
    <Panel title="Kuota dan Perangkat"><Line label="Jumlah Kuota" value={`${n('kuota_gb')} GB`} /><Line label="Biaya Kuota" value={rupiah(n('kuota_nominal'))} /><Line label="Provider atau Perangkat" value={data.kuota_provider || 'Belum diisi'} /><Line label="Catatan" value={data.kuota_catatan || 'Tidak ada catatan'} />{photo(data.kuota_nominal_photo, 'Bukti Kuota')}</Panel>
  </div></div>;
}
