export interface DevicePosition { latitude: number; longitude: number; accuracy: number }

// Fresh device measurement only. No IP lookup, tiles, or geocoding requests.
export function readDeviceLocation(geolocation: Geolocation | undefined = navigator.geolocation): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (!geolocation) { reject(new Error('Perangkat tidak mendukung GPS.')); return; }
    geolocation.getCurrentPosition(position => {
      const { latitude, longitude, accuracy } = position.coords;
      if (![latitude, longitude, accuracy].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy <= 0) {
        reject(new Error('Koordinat GPS perangkat tidak valid. Perbarui GPS lalu coba lagi.')); return;
      }
      resolve({ latitude, longitude, accuracy: Math.ceil(accuracy) });
    }, error => reject(new Error(error.code === 1
      ? 'Izin lokasi ditolak. Izinkan lokasi perangkat sebelum mengirim absensi.'
      : 'GPS belum dapat diperbarui. Aktifkan lokasi presisi dan coba lagi.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  });
}
