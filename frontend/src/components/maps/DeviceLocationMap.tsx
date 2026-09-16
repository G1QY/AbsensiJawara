import {t as translateUI} from '../../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Display only. This component never writes attendance coordinates or geocodes.
export default function DeviceLocationMap({ latitude, longitude, accuracy }: {
  latitude: number; longitude: number; accuracy: number | null;
}) {
  const key = String(import.meta.env.VITE_MAPTILER_API_KEY || '').trim();
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const areaRef = useRef<L.Circle | null>(null);
  const initial = useRef({ latitude, longitude });

  useEffect(() => {
    if (!opened || !key || !container.current) return;
    const point: L.LatLngExpression = [initial.current.latitude, initial.current.longitude];
    const map = L.map(container.current, {
      dragging: false, touchZoom: false, doubleClickZoom: false,
      scrollWheelZoom: false, boxZoom: false, keyboard: false, zoomControl: false,
    }).setView(point, 17);
    mapRef.current = map;
    const tiles = L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`, {
      tileSize: 512, zoomOffset: -1, maxZoom: 19,
      attribution: '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap contributors</a>',
    });
    tiles.on('tileerror', () => setError('Peta belum dapat dimuat. Koordinat GPS tetap dapat digunakan untuk absensi.'));
    tiles.addTo(map);
    markerRef.current = L.circleMarker(point, {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false,
    }).addTo(map);
    areaRef.current = L.circle(point, { radius: 0, color: '#2563eb', fillOpacity: 0.12, weight: 1, interactive: false }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); tiles.off(); map.remove(); mapRef.current = null; };
  }, [opened, key]);

  // Reuse the map and tile layer when GPS changes, rather than initializing again.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const point: L.LatLngExpression = [latitude, longitude];
    markerRef.current?.setLatLng(point);
    areaRef.current?.setLatLng(point).setRadius(accuracy && accuracy > 0 ? accuracy : 0);
    if (accuracy && accuracy > 0 && areaRef.current) {
      map.fitBounds(areaRef.current.getBounds(), { padding: [24, 24], maxZoom: 17, animate: false });
    } else map.setView(point, 17, { animate: false });
  }, [latitude, longitude, accuracy, opened]);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">{translateUI("Peta Lokasi Kehadiran")}</h3>
      <p className="text-xs text-slate-600">{translateUI("Titik mengikuti lokasi perangkat. Lingkaran menunjukkan perkiraan akurasi.")}</p>
      {!opened && key && <button type="button" className="rounded-xl border border-blue-200 px-3 py-2 text-sm text-blue-700" onClick={() => setOpened(true)}>{translateUI("Tampilkan peta")}</button>}
      {!key && <p className="text-xs text-slate-600">{translateUI("Pratinjau peta belum tersedia. Koordinat GPS tetap tercatat.")}</p>}
      {opened && key && <div ref={container} role="img" aria-label={`Lokasi perangkat: ${latitude}, ${longitude}`} style={{ height: 260, width: '100%', borderRadius: 12, zIndex: 0 }} />}
      {error && <p role="status" className="text-xs text-amber-700">{translateUI(error)}</p>}
      <a className="inline-block text-xs text-blue-700 underline" href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer">{translateUI("Buka titik GPS di Google Maps")}</a>
    </section>
  );
}
