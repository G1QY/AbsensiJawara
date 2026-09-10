import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Display only: this component cannot write attendance coordinates.
export default function DeviceLocationMap({ latitude, longitude, accuracy }: {
  latitude: number; longitude: number; accuracy: number | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, {
      dragging: false, touchZoom: false, doubleClickZoom: false,
      scrollWheelZoom: false, boxZoom: false, keyboard: false, zoomControl: false,
    }).setView([latitude, longitude], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (accuracy !== null && accuracy > 0) {
      const area = L.circle([latitude, longitude], {
        radius: accuracy, color: '#2563eb', fillOpacity: 0.12, weight: 1, interactive: false,
      }).addTo(map);
      map.fitBounds(area.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
    L.circleMarker([latitude, longitude], {
      radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false,
    }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [latitude, longitude, accuracy]);
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">Peta Lokasi Kehadiran</h3>
      <p className="text-xs text-slate-600">Titik mengikuti lokasi perangkat. Lingkaran menunjukkan perkiraan akurasi.</p>
      <div ref={container} role="img" aria-label={`Lokasi perangkat: ${latitude}, ${longitude}`} style={{ height: 260, width: '100%', borderRadius: 12, zIndex: 0 }} />
    </section>
  );
}
