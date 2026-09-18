import { t, tx } from '../../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { osmTiles } from './osmTiles';
import { reverseAddress, searchAddress, type AddressResult } from '../../lib/geocoding';
import { readDeviceLocation } from '../../lib/deviceLocation';

type LocationValue = { address: string; latitude: string; longitude: string };
type Props = LocationValue & { onChange: (value: LocationValue) => void; title?: string };
const valid = (value: string, limit: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;
const pinIcon = L.divIcon({ className: '', html: '<div style="width:24px;height:24px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 1px 5px #333"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });

export default function OpenStreetMapLocationPicker(props: Props) {
  const { address, latitude, longitude, onChange, title = 'Lokasi Event' } = props;
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [results, setResults] = useState<AddressResult[]>([]);
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null), marker = useRef<L.Marker | null>(null);
  const current = useRef(props); current.current = props;
  const revision = useRef(0), working = useRef(false);
  const selected = valid(latitude, 90) && valid(longitude, 180);
  const candidate = useRef<L.LatLngLiteral | null>(selected ? { lat: Number(latitude), lng: Number(longitude) } : null);
  useEffect(() => { setQuery(address); }, [address]);

  function invalidate() { revision.current++; working.current = false; setLoading(false); setResults([]); setError(''); }
  function choosePoint(point: L.LatLngLiteral, nextAddress = '') {
    invalidate(); candidate.current = point; setQuery(nextAddress);
    current.current.onChange({ address: nextAddress, latitude: point.lat.toFixed(7), longitude: point.lng.toFixed(7) });
    if (mapRef.current) {
      marker.current?.setLatLng(point).addTo(mapRef.current);
      mapRef.current.setView(point, 17);
    }
  }
  async function lookupPoint(point: L.LatLngLiteral) {
    choosePoint(point);
    const id = ++revision.current;
    working.current = true; setLoading(true);
    try {
      const result = await reverseAddress(point.lat, point.lng);
      if (id !== revision.current) return;
      if (!result) throw new Error('Alamat tidak ditemukan. Isi alamat dan konfirmasikan untuk titik pilihan.');
      // Reverse geocoding returns a nearby mapped feature. Never move the chosen pin.
      choosePoint(point, result.address);
    } catch (reason) { if (id === revision.current) setError(reason instanceof Error ? reason.message : 'Pencarian alamat gagal.'); }
    finally { if (id === revision.current) { working.current = false; setLoading(false); } }
  }
  const pickRef = useRef(lookupPoint); pickRef.current = lookupPoint;
  useEffect(() => {
    if (!element.current) return;
    const p = current.current;
    const hasPoint = valid(p.latitude, 90) && valid(p.longitude, 180);
    const point: L.LatLngExpression = hasPoint ? [Number(p.latitude), Number(p.longitude)] : [-6.9175, 107.6191];
    const map = L.map(element.current, { scrollWheelZoom: false }).setView(point, hasPoint ? 17 : 12);
    mapRef.current = map;
    const tiles = osmTiles().addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    const pin = L.marker(point, { icon: pinIcon, draggable: true, title: t('Titik lokasi') });
    marker.current = pin;
    if (hasPoint) pin.addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => { void pickRef.current(event.latlng); });
    pin.on('dragend', () => { void pickRef.current(pin.getLatLng()); });
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(element.current);
    return () => { revision.current++; working.current = false; observer.disconnect(); tiles.off(); map.remove(); mapRef.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selected) {
      const point = { lat: Number(latitude), lng: Number(longitude) };
      candidate.current = point; marker.current?.setLatLng(point).addTo(map); map.panTo(point);
    } else marker.current?.remove();
  }, [latitude, longitude, selected]);

  async function search() {
    if (working.current || query.trim().length < 3) return;
    const id = ++revision.current;
    working.current = true; setLoading(true); setError(''); setResults([]);
    try {
      const found = await searchAddress(query.trim());
      if (id !== revision.current) return;
      if (!found.length) throw new Error('Alamat tidak ditemukan. Tambahkan nama kota atau pilih titik peta dan konfirmasikan alamatnya.');
      // Explicit selection is necessary even when only one match is returned.
      setResults(found);
    } catch (reason) { if (id === revision.current) setError(reason instanceof Error ? reason.message : 'Pencarian alamat gagal.'); }
    finally { if (id === revision.current) { working.current = false; setLoading(false); } }
  }
  function changeQuery(value: string) {
    invalidate(); setQuery(value); onChange({ address: value, latitude: '', longitude: '' });
  }
  async function useDevice() {
    if (working.current) return;
    invalidate(); const id = revision.current; working.current = true; setLoading(true);
    try { const point = await readDeviceLocation(); if (id === revision.current) await lookupPoint({ lat: point.latitude, lng: point.longitude }); }
    catch (reason) { if (id === revision.current) setError(reason instanceof Error ? reason.message : 'Lokasi perangkat belum tersedia.'); }
    finally { if (id === revision.current) { working.current = false; setLoading(false); } }
  }
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3 min-w-0">
    <h3 className="text-sm font-semibold text-slate-900">{t(title)}</h3>
    <label className="block text-xs text-slate-600">{t('Cari alamat atau nama tempat')}
      <div className="mt-1 flex gap-2"><input aria-label={t('Cari alamat atau nama tempat')} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={query} maxLength={500}
        onChange={event => changeQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} placeholder={t('Contoh: Jalan Braga, Bandung')} />
        <button type="button" disabled={loading || query.trim().length < 3} onClick={() => void search()} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{t('Cari')}</button></div>
    </label>
    {!!results.length && <ul aria-label={t('Hasil pencarian alamat')} className="rounded-xl border bg-white divide-y">{results.map((result, index) => <li key={index}><button type="button" className="w-full p-3 text-left text-sm break-words hover:bg-blue-50" onClick={() => choosePoint({ lat: result.latitude, lng: result.longitude }, result.address)}>{result.address}</button></li>)}</ul>}
    <div ref={element} aria-label={t('Pilih titik lokasi pada peta')} style={{ height: 260, width: '100%', borderRadius: 12, zIndex: 0 }} />
    {tileError && <p role="status" className="text-xs text-amber-700">{t('Peta belum dapat dimuat. Pencarian alamat dan koordinat tetap dapat digunakan.')}</p>}
    <p className="text-xs text-slate-600 break-words" role="status">{selected ? tx('Titik tersimpan: {latitude}, {longitude}', { latitude, longitude }) : t('Cari lalu pilih hasil, atau pilih titik pada peta.')}</p>
    <p className="text-xs text-slate-600">{t('Klik peta atau geser penanda untuk mencari alamat titik tersebut.')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading} onClick={() => void useDevice()} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">{t('Gunakan lokasi perangkat')}</button>
      {selected && <button type="button" disabled={loading} onClick={() => void lookupPoint({ lat: Number(latitude), lng: Number(longitude) })} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">{t('Cari alamat titik ini')}</button>}
      {candidate.current && query.trim() && !selected && <button type="button" onClick={() => choosePoint(candidate.current!, query.trim())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs break-words">{t('Konfirmasi alamat untuk titik pilihan')} ({candidate.current.lat.toFixed(5)}, {candidate.current.lng.toFixed(5)})</button>}
    </div>
    {loading && <p role="status" className="text-xs text-slate-600">{t('Memproses lokasi...')}</p>}
    {error && <p role="alert" className="text-xs text-amber-700">{t(error)}</p>}
  </section>;
}
