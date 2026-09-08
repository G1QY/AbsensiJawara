import { useEffect, useRef, useState } from 'react';

type LocationValue = { address: string; latitude: string; longitude: string };

let mapsLoader: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  const current = (window as any).google?.maps;
  if (current) return Promise.resolve(current);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const callback = `__fotosnapsMapsReady${Date.now()}`;
    (window as any)[callback] = () => {
      delete (window as any)[callback];
      resolve((window as any).google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=id&region=ID&callback=${callback}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsLoader = null;
      delete (window as any)[callback];
      reject(new Error('Google Maps gagal dimuat. Periksa API key dan koneksi internet.'));
    };
    document.head.appendChild(script);
  });
  return mapsLoader;
}

const validCoordinate = (value: string, limit: number) => value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

export default function GoogleLocationPicker({ address, latitude, longitude, onChange, title = 'Lokasi Event' }: {
  address: string;
  latitude: string;
  longitude: string;
  onChange: (value: LocationValue) => void;
  title?: string;
}) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const geocoder = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selected = validCoordinate(latitude, 90) && validCoordinate(longitude, 180);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { setQuery(address); }, [address]);

  const choosePoint = (position: { lat: number; lng: number }, nextAddress?: string) => {
    marker.current?.setPosition(position);
    marker.current?.setMap(map.current);
    map.current?.panTo(position);
    onChangeRef.current({
      address: nextAddress || address || query || 'Lokasi dipilih dari Google Maps',
      latitude: position.lat.toFixed(7),
      longitude: position.lng.toFixed(7),
    });
  };

  const reverseGeocode = (position: { lat: number; lng: number }) => {
    setLoading(true); setError('');
    geocoder.current.geocode({ location: position }, (results: any[], status: string) => {
      setLoading(false);
      if (status !== 'OK' || !results?.[0]) {
        choosePoint(position);
        setError('Titik tersimpan, tetapi alamat tidak ditemukan.');
        return;
      }
      choosePoint(position, results[0].formatted_address);
    });
  };

  useEffect(() => {
    if (!apiKey || !mapElement.current) return;
    let active = true;
    loadGoogleMaps(apiKey).then(maps => {
      if (!active || !mapElement.current) return;
      const initial = selected ? { lat: Number(latitude), lng: Number(longitude) } : { lat: -6.9175, lng: 107.6191 };
      map.current = new maps.Map(mapElement.current, { center: initial, zoom: selected ? 17 : 12, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
      marker.current = new maps.Marker({ map: selected ? map.current : null, position: initial, draggable: true, title: 'Lokasi absensi' });
      geocoder.current = new maps.Geocoder();
      map.current.addListener('click', (event: any) => reverseGeocode({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
      marker.current.addListener('dragend', (event: any) => reverseGeocode({ lat: event.latLng.lat(), lng: event.latLng.lng() }));
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Google Maps gagal dimuat.'); });
    return () => { active = false; map.current = null; marker.current = null; geocoder.current = null; };
  }, [apiKey]);

  useEffect(() => {
    if (!map.current || !marker.current || !selected) return;
    const position = { lat: Number(latitude), lng: Number(longitude) };
    marker.current.setPosition(position);
    marker.current.setMap(map.current);
  }, [latitude, longitude, selected]);

  const search = () => {
    if (!geocoder.current || !query.trim()) return;
    setLoading(true); setError('');
    geocoder.current.geocode({ address: query.trim(), region: 'ID' }, (results: any[], status: string) => {
      setLoading(false);
      if (status !== 'OK' || !results?.[0]?.geometry?.location) { setError('Lokasi tidak ditemukan. Tambahkan nama kota atau pilih langsung di peta.'); return; }
      const result = results[0];
      const position = { lat: result.geometry.location.lat(), lng: result.geometry.location.lng() };
      const bounds = result.geometry.viewport || result.geometry.bounds;
      if (bounds) map.current.fitBounds(bounds);
      else { map.current.setCenter(position); map.current.setZoom(16); }
      map.current.setZoom(Math.max(map.current.getZoom() || 16, 16));
      choosePoint(position, result.formatted_address);
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Browser ini tidak mendukung lokasi perangkat.'); return; }
    setLoading(true); setError('');
    navigator.geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      map.current?.setZoom(18);
      if (geocoder.current) reverseGeocode(point); else { setLoading(false); choosePoint(point); }
    }, () => { setLoading(false); setError('Lokasi perangkat tidak dapat diakses. Izinkan akses lokasi di browser.'); }, { enableHighAccuracy: true, timeout: 15000 });
  };

  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
    <div><h3 className="text-sm font-semibold text-slate-900">{title} di Google Maps</h3><p className="mt-1 text-xs text-slate-500">Cari alamat, klik peta, atau geser penanda. Koordinat tersimpan otomatis.</p></div>
    <div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Cari lokasi di Google Maps" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();search();}}} placeholder="Contoh: Surapati Core, Bandung" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/><button type="button" onClick={search} disabled={loading||!apiKey||!query.trim()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Cari</button></div>
    {apiKey ? <div ref={mapElement} className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200" aria-label="Peta pemilih lokasi"/> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Google Maps belum aktif. Isi VITE_GOOGLE_MAPS_API_KEY pada konfigurasi frontend.</div>}
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={useCurrentLocation} disabled={loading} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-50">Gunakan Lokasi Perangkat</button>{selected&&<a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">Buka di Google Maps</a>}<span className={`text-xs font-medium ${selected?'text-emerald-700':'text-amber-700'}`}>{selected?'Lokasi sudah dipilih':'Pilih satu titik sebelum menyimpan'}</span></div>
    {selected&&<p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"><span className="block text-xs text-slate-500">Alamat terpilih</span>{address}</p>}
    {loading&&<p role="status" className="text-xs text-blue-700">Mencari lokasi…</p>}{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
  </section>;
}
