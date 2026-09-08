import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const validCoordinate = (value: string, limit: number) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= limit;

const leafletPinIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 5px rgba(0,0,0,0.35));cursor:pointer;">
    <svg width="34" height="44" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#2563EB"/>
      <circle cx="12" cy="12" r="5" fill="#FFFFFF"/>
    </svg>
  </div>`,
  iconSize: [34, 44],
  iconAnchor: [17, 44],
});

export default function GoogleLocationPicker({
  address,
  latitude,
  longitude,
  onChange,
  title = 'Lokasi Event',
}: {
  address: string;
  latitude: string;
  longitude: string;
  onChange: (value: LocationValue) => void;
  title?: string;
}) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  // Map elements
  const googleMapElement = useRef<HTMLDivElement>(null);
  const osmMapElement = useRef<HTMLDivElement>(null);

  // Google Maps instances
  const googleMap = useRef<any>(null);
  const googleMarker = useRef<any>(null);
  const geocoder = useRef<any>(null);

  // Leaflet instances
  const leafletMap = useRef<L.Map | null>(null);
  const leafletMarker = useRef<L.Marker | null>(null);

  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState(address);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleAuthError, setGoogleAuthError] = useState(false);
  const [provider, setProvider] = useState<'google' | 'osm'>(() => (!apiKey ? 'osm' : 'google'));
  const [showManualInput, setShowManualInput] = useState(false);

  const selected = validCoordinate(latitude, 90) && validCoordinate(longitude, 180);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setQuery(address);
  }, [address]);

  // Listen for Google Maps authentication failures (e.g. RefererNotAllowedMapError, BillingNotEnabledMapError, ApiNotActivatedMapError)
  useEffect(() => {
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setGoogleAuthError(true);
      setProvider('osm');
      setError('Google Maps gagal diverifikasi (domain belum diizinkan atau billing belum aktif di Google Cloud). Dialihkan ke OpenStreetMap.');
      if (typeof prevAuthFailure === 'function') prevAuthFailure();
    };
    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
    };
  }, []);

  const choosePoint = (position: { lat: number; lng: number }, nextAddress?: string) => {
    const finalAddress = nextAddress || address || query || 'Lokasi dipilih dari peta';
    const latStr = position.lat.toFixed(7);
    const lngStr = position.lng.toFixed(7);

    // Sync Google Maps if active
    if (googleMap.current && googleMarker.current) {
      googleMarker.current.setPosition(position);
      googleMarker.current.setMap(googleMap.current);
      googleMap.current.panTo(position);
    }

    // Sync Leaflet if active
    if (leafletMap.current) {
      if (leafletMarker.current) {
        leafletMarker.current.setLatLng([position.lat, position.lng]);
      } else {
        leafletMarker.current = L.marker([position.lat, position.lng], {
          icon: leafletPinIcon,
          draggable: true,
        }).addTo(leafletMap.current);
        leafletMarker.current.on('dragend', () => {
          const pt = leafletMarker.current!.getLatLng();
          reverseGeocodeOSM({ lat: pt.lat, lng: pt.lng });
        });
      }
      leafletMap.current.panTo([position.lat, position.lng]);
    }

    onChangeRef.current({
      address: finalAddress,
      latitude: position.lat.toFixed(7),
      longitude: position.lng.toFixed(7),
    });
  };

  const reverseGeocodeGoogle = (position: { lat: number; lng: number }) => {
    if (!geocoder.current) {
      reverseGeocodeOSM(position);
      return;
    }
    setLoading(true);
    setError('');
    geocoder.current.geocode({ location: position }, (results: any[], status: string) => {
      setLoading(false);
      if (status !== 'OK' || !results?.[0]) {
        choosePoint(position);
        setError('Titik tersimpan, tetapi nama jalan tidak ditemukan.');
        return;
      }
      choosePoint(position, results[0].formatted_address);
    });
  };

  const reverseGeocodeOSM = async (position: { lat: number; lng: number }) => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&addressdetails=1`,
        { headers: { 'Accept-Language': 'id,en' } }
      );
      if (resp.ok) {
        const data = await resp.json();
        choosePoint(position, data.display_name || undefined);
      } else {
        choosePoint(position);
      }
    } catch {
      choosePoint(position);
    } finally {
      setLoading(false);
    }
  };

  // Initialize Google Maps
  useEffect(() => {
    if (provider !== 'google' || !apiKey || !googleMapElement.current) return;
    let active = true;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!active || !googleMapElement.current) return;
        const initial = selected
          ? { lat: Number(latitude), lng: Number(longitude) }
          : { lat: -6.9175, lng: 107.6191 };

        googleMap.current = new maps.Map(googleMapElement.current, {
          center: initial,
          zoom: selected ? 17 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        googleMarker.current = new maps.Marker({
          map: selected ? googleMap.current : null,
          position: initial,
          draggable: true,
          title: 'Lokasi absensi',
        });

        geocoder.current = new maps.Geocoder();

        googleMap.current.addListener('click', (event: any) =>
          reverseGeocodeGoogle({ lat: event.latLng.lat(), lng: event.latLng.lng() })
        );

        googleMarker.current.addListener('dragend', (event: any) =>
          reverseGeocodeGoogle({ lat: event.latLng.lat(), lng: event.latLng.lng() })
        );
      })
      .catch((reason) => {
        if (active) {
          setGoogleAuthError(true);
          setProvider('osm');
          setError(
            reason instanceof Error ? reason.message : 'Google Maps gagal dimuat. Beralih ke OpenStreetMap.'
          );
        }
      });

    return () => {
      active = false;
      googleMap.current = null;
      googleMarker.current = null;
      geocoder.current = null;
    };
  }, [provider, apiKey]);

  // Initialize Leaflet (OpenStreetMap)
  useEffect(() => {
    if (provider !== 'osm' || !osmMapElement.current) return;

    const initialLat = selected ? Number(latitude) : -6.9175;
    const initialLng = selected ? Number(longitude) : 107.6191;

    if (!leafletMap.current) {
      const map = L.map(osmMapElement.current, {
        center: [initialLat, initialLng],
        zoom: selected ? 17 : 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        reverseGeocodeOSM({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      if (selected) {
        leafletMarker.current = L.marker([initialLat, initialLng], {
          icon: leafletPinIcon,
          draggable: true,
        }).addTo(map);

        leafletMarker.current.on('dragend', () => {
          const pt = leafletMarker.current!.getLatLng();
          reverseGeocodeOSM({ lat: pt.lat, lng: pt.lng });
        });
      }

      leafletMap.current = map;

      // Invalidate size after modal render
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } else {
      leafletMap.current.invalidateSize();
      if (selected) {
        const pt: [number, number] = [Number(latitude), Number(longitude)];
        if (leafletMarker.current) {
          leafletMarker.current.setLatLng(pt);
        } else {
          leafletMarker.current = L.marker(pt, {
            icon: leafletPinIcon,
            draggable: true,
          }).addTo(leafletMap.current);
          leafletMarker.current.on('dragend', () => {
            const p = leafletMarker.current!.getLatLng();
            reverseGeocodeOSM({ lat: p.lat, lng: p.lng });
          });
        }
        leafletMap.current.setView(pt, Math.max(leafletMap.current.getZoom(), 16));
      }
    }

    return () => {
      // Don't necessarily destroy instantly on rerender to prevent flicker, but clean up if unmounted
    };
  }, [provider, selected]);

  // Cleanup Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        leafletMarker.current = null;
      }
    };
  }, []);

  // Sync marker when coordinates change externally
  useEffect(() => {
    if (!selected) return;
    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (googleMap.current && googleMarker.current) {
      const position = { lat: latNum, lng: lngNum };
      googleMarker.current.setPosition(position);
      googleMarker.current.setMap(googleMap.current);
    }

    if (leafletMap.current) {
      if (leafletMarker.current) {
        leafletMarker.current.setLatLng([latNum, lngNum]);
      } else {
        leafletMarker.current = L.marker([latNum, lngNum], {
          icon: leafletPinIcon,
          draggable: true,
        }).addTo(leafletMap.current);
        leafletMarker.current.on('dragend', () => {
          const p = leafletMarker.current!.getLatLng();
          reverseGeocodeOSM({ lat: p.lat, lng: p.lng });
        });
      }
    }
  }, [latitude, longitude, selected]);

  const searchGoogle = () => {
    if (!geocoder.current || !query.trim()) return;
    setLoading(true);
    setError('');
    geocoder.current.geocode(
      { address: query.trim(), region: 'ID' },
      (results: any[], status: string) => {
        setLoading(false);
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          searchOSM(); // fallback to OSM if google geocoder fails
          return;
        }
        const result = results[0];
        const position = {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        };
        const bounds = result.geometry.viewport || result.geometry.bounds;
        if (bounds && googleMap.current) googleMap.current.fitBounds(bounds);
        else if (googleMap.current) {
          googleMap.current.setCenter(position);
          googleMap.current.setZoom(16);
        }
        choosePoint(position, result.formatted_address);
      }
    );
  };

  const searchOSM = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&countrycodes=id&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'id,en' } }
      );
      if (!resp.ok) throw new Error('Pencarian gagal');
      const data = await resp.json();
      if (!data || data.length === 0) {
        setError('Lokasi tidak ditemukan. Coba tambahkan nama kota atau klik langsung pada peta.');
        return;
      }
      const item = data[0];
      const position = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
      choosePoint(position, item.display_name);
      if (leafletMap.current) {
        leafletMap.current.setView([position.lat, position.lng], 16);
      }
    } catch {
      setError('Pencarian lokasi gagal. Periksa koneksi internet atau pilih langsung di peta.');
    } finally {
      setLoading(false);
    }
  };

  const search = () => {
    if (provider === 'google' && geocoder.current && !googleAuthError) {
      searchGoogle();
    } else {
      searchOSM();
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser ini tidak mendukung lokasi perangkat.');
      return;
    }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (provider === 'google' && googleMap.current && geocoder.current && !googleAuthError) {
          googleMap.current?.setZoom(18);
          reverseGeocodeGoogle(point);
        } else {
          if (leafletMap.current) {
            leafletMap.current.setView([point.lat, point.lng], 18);
          }
          reverseGeocodeOSM(point);
        }
      },
      () => {
        setLoading(false);
        setError('Lokasi perangkat tidak dapat diakses. Izinkan akses lokasi di browser.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleManualCoordChange = (field: 'latitude' | 'longitude', val: string) => {
    const nextLat = field === 'latitude' ? val : latitude;
    const nextLng = field === 'longitude' ? val : longitude;
    onChangeRef.current({
      address: address || 'Koordinat diisi manual',
      latitude: nextLat,
      longitude: nextLng,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Cari alamat, klik peta, atau geser penanda. Koordinat tersimpan otomatis.
          </p>
        </div>

        {/* Provider Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setProvider('osm');
              setError('');
            }}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${provider === 'osm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            OpenStreetMap
          </button>
          <button
            type="button"
            onClick={() => {
              if (!apiKey) {
                setError('VITE_GOOGLE_MAPS_API_KEY belum dikonfigurasi.');
                return;
              }
              setProvider('google');
              setError('');
            }}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${provider === 'google'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Google Maps
          </button>
        </div>
      </div>

      {/* Google Maps Error Alert / Notice */}
      {googleAuthError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-center justify-between font-semibold">
            <span>Google Maps Tidak Dapat Memuat Peta</span>
            <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[11px] font-mono">
              Auto-Fallback Aktif
            </span>
          </div>
          <p className="mt-1 text-amber-800">
            Google Cloud menolak otentikasi API Key (domain{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
              absensijawara-ui.onrender.com
            </code>{' '}
            belum diizinkan di HTTP referrers, atau Billing belum diaktifkan).
          </p>
          <p className="mt-1 font-medium text-blue-800">
            Peta telah dialihkan ke <strong>OpenStreetMap</strong> sehingga Anda tetap dapat memilih lokasi, klik titik, dan menyimpan store seperti biasa.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Cari lokasi di Google Maps"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              search();
            }
          }}
          placeholder="Contoh: Surapati Core, Bandung atau Jalan Riau"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </div>

      {/* Map View */}
      {provider === 'google' && apiKey ? (
        <div
          ref={googleMapElement}
          className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-200"
          aria-label="Peta pemilih lokasi"
        />
      ) : provider === 'google' && !apiKey ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Google Maps belum aktif. Isi VITE_GOOGLE_MAPS_API_KEY pada konfigurasi frontend, atau beralih ke OpenStreetMap di pojok kanan atas.
        </div>
      ) : (
        <div
          ref={osmMapElement}
          className="h-72 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 relative z-0"
          aria-label="Peta pemilih lokasi"
        />
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={loading}
          className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          Gunakan Lokasi Perangkat
        </button>

        {selected && (
          <a
            href={`https://www.google.com/maps?q=${latitude},${longitude}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Buka di Google Maps
          </a>
        )}

        <button
          type="button"
          onClick={() => setShowManualInput(!showManualInput)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {showManualInput ? 'Sembunyikan Koordinat' : 'Input Koordinat Manual'}
        </button>

        <span
          className={`ml-auto text-xs font-medium ${selected ? 'text-emerald-700' : 'text-amber-700'
            }`}
        >
          {selected ? 'Lokasi sudah dipilih' : 'Pilih satu titik sebelum menyimpan'}
        </span>
      </div>

      {/* Manual Input Fields */}
      {showManualInput && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-xs text-slate-600">
            Latitude
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
              value={latitude}
              placeholder="-6.9175"
              onChange={(e) => handleManualCoordChange('latitude', e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Longitude
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
              value={longitude}
              placeholder="107.6191"
              onChange={(e) => handleManualCoordChange('longitude', e.target.value)}
            />
          </label>
        </div>
      )}

      {/* Selected Address Display */}
      {selected && (
        <div className="rounded-xl bg-white p-3 text-sm text-slate-700 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Alamat Terpilih</span>
            <span className="text-[11px] font-mono text-slate-500">
              {latitude}, {longitude}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-800">{address || 'Titik koordinat ditentukan'}</p>
        </div>
      )}

      {loading && (
        <p role="status" className="text-xs text-blue-700 flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          Mencari lokasi…
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
          {error}
        </p>
      )}
    </section>
  );
}
