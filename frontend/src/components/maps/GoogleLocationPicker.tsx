import { useEffect, useRef, useState } from 'react';

type LocationValue = { address: string; latitude: string; longitude: string };
type Props = LocationValue & { onChange: (value: LocationValue) => void; title?: string };
let mapsLoader: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const callback = `__jawaraMapsReady${Date.now()}`;
    const script = document.createElement('script');
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true; clearTimeout(timer); script.remove(); mapsLoader = null;
      delete (window as any)[callback];
      reject(new Error('Google Maps gagal dimuat. Periksa koneksi dan konfigurasi Google Maps.'));
    };
    const timer = window.setTimeout(fail, 15000);
    (window as any)[callback] = () => {
      if (settled) return;
      settled = true; clearTimeout(timer); delete (window as any)[callback];
      resolve((window as any).google.maps);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=id&region=ID&callback=${callback}`;
    script.async = true; script.onerror = fail; document.head.appendChild(script);
  });
  return mapsLoader;
}
const valid = (value: string, limit: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

// Admin only. No map load before explicit opening, and no geocoding on mount or pin movement.
export default function GoogleLocationPicker(props: Props) {
  const { address, latitude, longitude, onChange, title = 'Lokasi Event' } = props;
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(address);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null), marker = useRef<any>(null), geocoder = useRef<any>(null);
  const current = useRef(props);
  current.current = props;
  const revision = useRef(0);
  const working = useRef(false);
  useEffect(() => () => { revision.current++; working.current = false; }, []);
  const selected = valid(latitude, 90) && valid(longitude, 180);
  useEffect(() => { setQuery(address); revision.current++; working.current = false; setLoading(false); }, [address, latitude, longitude]);

  const choosePoint = (position: { lat: number; lng: number }, nextAddress?: string) => {
    revision.current++; working.current = false; setLoading(false);
    current.current.onChange({
      address: nextAddress ?? current.current.address,
      latitude: position.lat.toFixed(7), longitude: position.lng.toFixed(7),
    });
    marker.current?.setPosition(position); marker.current?.setMap(map.current);
    map.current?.panTo(position);
  };

  useEffect(() => {
    if (!opened || !apiKey || !element.current) return;
    let active = true;
    const previous = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      if (active) { setReady(false); setError('Google Maps belum dapat digunakan. Periksa izin domain dan API key.'); }
      if (typeof previous === 'function') previous();
    };
    loadGoogleMaps(apiKey).then(maps => {
      if (!active || !element.current) return;
      const p = current.current;
      const hasPoint = valid(p.latitude, 90) && valid(p.longitude, 180);
      const position = hasPoint ? { lat: Number(p.latitude), lng: Number(p.longitude) } : { lat: -6.9175, lng: 107.6191 };
      map.current = new maps.Map(element.current, { center: position, zoom: hasPoint ? 17 : 12,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
      marker.current = new maps.Marker({ map: hasPoint ? map.current : null, position, draggable: true });
      geocoder.current = new maps.Geocoder();
      map.current.addListener('click', (event: any) => choosePoint({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
      marker.current.addListener('dragend', (event: any) => choosePoint({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
      setReady(true);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Peta gagal dimuat.'); });
    return () => {
      active = false; revision.current++; working.current = false;
      (window as any).gm_authFailure = previous;
      const maps = (window as any).google?.maps;
      if (map.current) maps?.event.clearInstanceListeners(map.current);
      if (marker.current) { maps?.event.clearInstanceListeners(marker.current); marker.current.setMap(null); }
      map.current = null; marker.current = null; geocoder.current = null;
    };
  }, [opened, apiKey]);

  useEffect(() => {
    if (!map.current) return;
    if (selected) {
      const point = { lat: Number(latitude), lng: Number(longitude) };
      marker.current?.setPosition(point); marker.current?.setMap(map.current); map.current.panTo(point);
    } else marker.current?.setMap(null);
  }, [latitude, longitude, selected]);

  async function lookup(reverse: boolean) {
    if (!ready || !geocoder.current || working.current || (!reverse && !query.trim())) return;
    working.current = true; setLoading(true); setError('');
    const id = ++revision.current;
    try {
      const response = await geocoder.current.geocode(reverse
        ? { location: { lat: Number(latitude), lng: Number(longitude) } }
        : { address: query.trim(), componentRestrictions: { country: 'ID' } });
      if (id !== revision.current) return;
      const result = response.results?.[0];
      if (!result) throw new Error('Alamat tidak ditemukan.');
      const point = reverse ? { lat: Number(latitude), lng: Number(longitude) }
        : { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() };
      choosePoint(point, result.formatted_address);
      if (!reverse && result.geometry.viewport) map.current?.fitBounds(result.geometry.viewport);
    } catch {
      if (id === revision.current) setError('Pencarian alamat gagal. Coba kata pencarian lain. Titik sebelumnya tetap tersimpan.');
    } finally {
      if (id === revision.current) { working.current = false; setLoading(false); }
    }
  }

  function useDevice() {
    if (working.current) return;
    if (!navigator.geolocation) { setError('Browser tidak mendukung lokasi perangkat.'); return; }
    const id = ++revision.current;
    working.current = true; setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(position => {
      if (id !== revision.current) return;
      choosePoint({ lat: position.coords.latitude, lng: position.coords.longitude });
    }, () => {
      if (id !== revision.current) return;
      working.current = false; setLoading(false); setError('Lokasi perangkat belum tersedia. Izinkan akses lokasi lalu coba lagi.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <label className="block text-xs text-slate-600">Alamat lokasi penugasan
      <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={address} maxLength={2000}
        onChange={e => onChange({ address: e.target.value, latitude, longitude })} placeholder="Alamat kantor, store, atau event" />
    </label>
    <p className="text-xs text-slate-600">{selected ? `Titik tersimpan: ${latitude}, ${longitude}` : 'Pilih titik lokasi melalui peta atau gunakan lokasi perangkat.'}</p>
    {!opened && apiKey && <button type="button" className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => setOpened(true)}>Buka peta / cari alamat</button>}
    {!apiKey && <p className="text-xs text-amber-700">Pencarian peta belum tersedia. Anda dapat menggunakan lokasi perangkat dan mengisi alamat penugasan.</p>}
    {opened && <>
      <div className="flex gap-2">
        <input disabled={loading} aria-label="Cari alamat di Google Maps" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Contoh: Surapati Core, Bandung" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void lookup(false); } }} />
        <button type="button" disabled={!ready || loading || !query.trim()} onClick={() => void lookup(false)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Cari</button>
      </div>
      <div ref={element} style={{ height: 260, width: '100%', borderRadius: 12 }} />
      <p className="text-xs text-slate-600">Klik peta atau geser penanda untuk memilih titik. Periksa alamat penugasan sebelum menyimpan.</p>
      <button type="button" disabled={!selected || !ready || loading} onClick={() => void lookup(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">Cari alamat titik ini</button>
    </>}
    <button type="button" disabled={loading} onClick={useDevice} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">Gunakan lokasi perangkat</button>
    {loading && <p role="status" className="text-xs text-slate-600">Memproses lokasi...</p>}
    {error && <p role="alert" className="text-xs text-amber-700">{error}</p>}
  </section>;
}
