import { useState, useCallback } from 'react';

interface GeoResult {
  latitude: number;
  longitude: number;
}

/**
 * Hook untuk ambil koordinat GPS asli lewat navigator.geolocation.
 * Dipakai saat Clock In/Out — HARUS dipanggil ulang setiap kali (bukan
 * di-cache), supaya lokasi yang dikirim ke backend benar-benar real-time.
 */
export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPosition = useCallback((): Promise<GeoResult> => {
    setLoading(true);
    setError('');

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Perangkat/browser ini tidak mendukung GPS.';
        setError(msg);
        setLoading(false);
        reject(new Error(msg));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false);
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          setLoading(false);
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'Izin lokasi ditolak. Aktifkan izin GPS untuk browser ini di pengaturan perangkat.'
              : 'Gagal mengambil lokasi GPS. Pastikan GPS aktif dan coba lagi.';
          setError(msg);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { getPosition, loading, error };
}
