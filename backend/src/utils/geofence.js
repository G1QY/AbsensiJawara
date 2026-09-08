// Perhitungan jarak GPS (Haversine) untuk validasi geofence check-in/out.
// Ref: PRD Section 4 — "distance <= 50m -> berhasil, > 50m -> ditolak (HTTP 422)"

const EARTH_RADIUS_METERS = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Menghitung jarak antara dua koordinat GPS dalam meter. */
function distanceInMeters(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/** Validasi apakah titik crew berada di dalam radius lokasi (store/event). */
function isWithinGeofence(crewLat, crewLng, locationLat, locationLng, radiusMeters) {
  const distance = distanceInMeters(crewLat, crewLng, locationLat, locationLng);
  return { withinRadius: distance <= radiusMeters, distanceMeters: Math.round(distance * 100) / 100 };
}

module.exports = { distanceInMeters, isWithinGeofence };
