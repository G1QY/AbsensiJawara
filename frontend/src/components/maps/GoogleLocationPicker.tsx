import {t as translateUI,tx} from '../../lib/i18n';
import { useEffect, useRef, useState } from 'react';

type SearchResult = { address: string; lat: number; lng: number };
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
  const [results,setResults] = useState<SearchResult[]>([]);
  const [searchRequested,setSearchRequested] = useState(false);
  const candidate = useRef<{lat:number;lng:number}|null>(null);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null), marker = useRef<any>(null), geocoder = useRef<any>(null);
  const current = useRef(props);
  current.current = props;
  const revision = useRef(0);
  const working = useRef(false);
  useEffect(() => () => { revision.current++; working.current = false; }, []);
  const selected = valid(latitude, 90) && valid(longitude, 180);
  if (selected) candidate.current = {lat:Number(latitude),lng:Number(longitude)};
  useEffect(() => { setQuery(address); revision.current++; working.current = false; setLoading(false); }, [address, latitude, longitude]);

  const choosePoint = (position: { lat: number; lng: number }, nextAddress?: string) => {
    revision.current++; working.current = false; setLoading(false);
    candidate.current = position; setResults([]); setError('');
    setQuery(nextAddress ?? '');
    current.current.onChange({
      address: nextAddress ?? '',
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
    working.current = true; setLoading(true); setError(''); setResults([]);
    const id = ++revision.current;
    try {
      let found: SearchResult[] = [];
      let geocodeError: any;
      try {
        const response = await geocoder.current.geocode(reverse
          ? { location: { lat: Number(latitude), lng: Number(longitude) } }
          : { address: query.trim(), componentRestrictions: { country: 'ID' } });
        found = (response.results || []).slice(0,5).map((result:any)=>({address:result.formatted_address,
          lat:reverse?Number(latitude):result.geometry.location.lat(),lng:reverse?Number(longitude):result.geometry.location.lng()}));
      } catch (reason) { geocodeError=reason; }
      // Business names may be in Places rather than the address geocoder.
      if (!reverse && !found.length && (window as any).google?.maps?.importLibrary) {
        try {
          const {Place}=await (window as any).google.maps.importLibrary('places');
          const response=await Place.searchByText({textQuery:query.trim(),fields:['formattedAddress','location'],region:'id',language:'id',maxResultCount:5});
          found=(response.places || []).filter((place:any)=>place.location).map((place:any)=>({address:place.formattedAddress||query.trim(),lat:place.location.lat(),lng:place.location.lng()}));
        } catch(reason) { geocodeError=geocodeError||reason; }
      }
      if (id !== revision.current) return;
      if (!found.length) {
        const code=String(geocodeError?.code || geocodeError?.message || '');
        if (/DENIED|not authorized|ApiNotActivated|Billing|PERMISSION/i.test(code)) throw new Error('Pencarian ditolak Google. Admin perlu mengaktifkan Geocoding API atau Places API (New), billing, dan izin domain pada API key.');
        if (/LIMIT|quota|RESOURCE_EXHAUSTED/i.test(code)) throw new Error('Kuota pencarian Google habis. Coba lagi setelah kuota tersedia.');
        throw new Error('Alamat tidak ditemukan. Tambahkan nama kota atau pilih titik peta dan konfirmasikan alamatnya.');
      }
      if (found.length===1 || reverse) choosePoint({lat:found[0].lat,lng:found[0].lng},found[0].address);
      else setResults(found);
    } catch (reason) {
      if (id === revision.current) setError(reason instanceof Error?reason.message:'Pencarian alamat gagal.');
    } finally {
      if (id === revision.current) { working.current = false; setLoading(false); }
    }
  }
  useEffect(()=>{if(ready && searchRequested){setSearchRequested(false);void lookup(false);}},[ready,searchRequested]);
  function search() { if(!query.trim())return; setOpened(true);setSearchRequested(true); }
  function changeQuery(value:string) {
    revision.current++;working.current=false;setLoading(false);setResults([]);setError('');setQuery(value);
    onChange({address:value,latitude:'',longitude:''});
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

  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 min-w-0">
    <h3 className="text-sm font-semibold text-slate-900">{translateUI(title)}</h3>
    <label className="block text-xs text-slate-600">{translateUI("Cari alamat atau nama tempat") + " "}<div className="mt-1 flex gap-2"><input aria-label={translateUI("Cari alamat atau nama tempat")} className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={query} maxLength={1000}
        onChange={e=>changeQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();search();}}} placeholder={translateUI("Contoh: Kopi Toko Tua, Braga, Bandung")} />
        <button type="button" disabled={loading||!apiKey||!query.trim()} onClick={search} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{translateUI("Cari")}</button></div>
    </label>
    {!!results.length && <ul aria-label={translateUI("Hasil pencarian alamat")} className="rounded-xl border bg-white divide-y">{results.map((result,index)=><li key={index}><button type="button" className="w-full p-3 text-left text-sm hover:bg-blue-50" onClick={()=>choosePoint({lat:result.lat,lng:result.lng},result.address)}>{result.address}</button></li>)}</ul>}
    <p className="text-xs text-slate-600" role="status">{selected ? tx('Titik tersimpan: {latitude}, {longitude}',{latitude,longitude}) : translateUI("Alamat berubah. Cari dan pilih hasil yang sesuai sebelum menyimpan.")}</p>
    {!opened && apiKey && <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={()=>setOpened(true)}>{translateUI("Buka peta")}</button>}
    {!apiKey && <p className="text-xs text-amber-700">{translateUI("Pencarian peta belum tersedia. Anda dapat menggunakan lokasi perangkat dan mengisi alamat penugasan.")}</p>}
    {opened && <>
      <div ref={element} style={{height:260,width:'100%',borderRadius:12}} />
      <p className="text-xs text-slate-600">{translateUI("Klik peta atau geser penanda, lalu cari alamat titik tersebut. Teks alamat dan titik disimpan bersama.")}</p>
      <button type="button" disabled={!selected||!ready||loading} onClick={()=>void lookup(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">{translateUI("Cari alamat titik ini")}</button>
    </>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={loading} onClick={useDevice} className="rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:opacity-50">{translateUI("Gunakan lokasi perangkat")}</button>
    {candidate.current && query.trim() && !selected && <button type="button" onClick={()=>choosePoint(candidate.current!,query.trim())} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">{translateUI("Konfirmasi alamat untuk titik pilihan")} ({candidate.current.lat.toFixed(5)}, {candidate.current.lng.toFixed(5)})</button>}</div>
    {loading && <p role="status" className="text-xs text-slate-600">{translateUI("Memproses lokasi...")}</p>}
    {error && <p role="alert" className="text-xs text-amber-700">{translateUI(error)}</p>}
  </section>;
}
