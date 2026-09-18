const { createHash, randomUUID } = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const failure = (message, status = 503) => Object.assign(new Error(message), { status });
function coordinate(value, limit) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit)
    throw failure('Koordinat tidak valid.', 400);
  return Number(value);
}
const unlockScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], 1100) end return 0`;
// All clients share one provider lock, including search and reverse. Keep at least
// 1.1 seconds between completed requests, not a fixed-window per-user limit.
function createGeocoder({ baseUrl = process.env.GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org',
  fetcher = global.fetch, getRedis = () => require('../../security/http').getSecurityStore(),
  now = Date.now, wait = sleep, queueMs = 4500,
  userAgent = process.env.GEOCODING_USER_AGENT || 'JawaraAttendance/10 (+https://github.com/G1QY/AbsensiJawara)' } = {}) {
  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('GEOCODING_BASE_URL harus URL HTTPS tanpa kredensial/query.');
  const prefix = 'jawara:geo:v2:' + createHash('sha256').update(endpoint.href).digest('hex').slice(0, 12) + ':';
  const cache = new Map(), pending = new Map();
  let locked = false, nextAt = 0, cooldown = 0;
  async function takeLock(redis) {
    const deadline = now() + queueMs;
    const token = randomUUID();
    do {
      if (redis) {
        try {
          if (await redis.get(prefix + 'cooldown')) throw failure('Layanan alamat sedang dibatasi. Coba lagi nanti.', 429);
          if (await redis.set(prefix + 'lock', token, { NX: true, PX: 12000 })) {
            return async () => { await redis.eval(unlockScript, { keys: [prefix + 'lock'], arguments: [token] }).catch(() => {}); };
          }
        } catch (error) { if (error.status) throw error; throw failure('Layanan alamat sedang sibuk. Coba lagi.'); }
      } else if (!locked && now() >= nextAt) {
        locked = true;
        return async () => { nextAt = now() + 1100; locked = false; };
      }
      if (now() >= deadline) break;
      await wait(Math.min(150, deadline - now()));
    } while (now() <= deadline);
    throw failure('Pencarian alamat sedang ramai. Coba lagi beberapa saat.', 429);
  }
  async function run(kind, params) {
    const key = prefix + 'cache:' + createHash('sha256').update(kind + JSON.stringify(params)).digest('hex');
    const local = cache.get(key);
    if (local && local.until > now()) return local.data;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 20) throw failure('Pencarian alamat sedang ramai. Coba lagi beberapa saat.', 429);
    const request = Promise.resolve().then(async () => {
      const redis = getRedis();
      // Fail closed when the shared limiter is unavailable in production.
      if ((process.env.REDIS_URL || process.env.NODE_ENV === 'production') && !redis?.isReady) throw failure('Layanan alamat sedang sibuk. Coba lagi.');
      const readCache = async () => {
        if (!redis) return null;
        let raw;
        try { raw = await redis.get(key); } catch { throw failure('Layanan alamat sedang sibuk. Coba lagi.'); }
        try { return raw ? JSON.parse(raw) : null; } catch { return null; }
      };
      const cached = await readCache();
      if (Array.isArray(cached)) return cached;
      if (cooldown > now()) throw failure('Layanan alamat sedang dibatasi. Coba lagi nanti.', 429);
      const release = await takeLock(redis);
      try {
        const shared = await readCache();
        if (Array.isArray(shared)) return shared;
        if (cooldown > now()) throw failure('Layanan alamat sedang dibatasi. Coba lagi nanti.', 429);
        const url = new URL(endpoint.href.replace(/\/$/, '') + '/' + kind);
        for (const [name, value] of Object.entries({ ...params, format: 'jsonv2', addressdetails: 1, 'accept-language': 'id' })) url.searchParams.set(name, String(value));
        let response;
        try { response = await fetcher(url, { signal: AbortSignal.timeout(6500), headers: { Accept: 'application/json', 'User-Agent': userAgent }, redirect: 'error' }); }
        catch { throw failure('Alamat belum dapat ditemukan karena layanan tidak merespons. Coba lagi.'); }
        if ([403, 429].includes(response.status)) {
          cooldown = now() + 60000;
          if (redis) await redis.set(prefix + 'cooldown', '1', { EX: 60 }).catch(() => {});
          throw failure('Layanan alamat sedang dibatasi. Coba lagi nanti.', 429);
        }
        if (!response.ok) throw failure('Layanan alamat belum tersedia. Coba lagi.');
        let body;
        try { body = await response.json(); } catch { throw failure('Respons layanan alamat tidak valid.'); }
        if (kind === 'search' ? !Array.isArray(body) : !body || typeof body !== 'object' || Array.isArray(body)) throw failure('Respons layanan alamat tidak valid.');
        const rows = kind === 'search' ? body : body.error ? [] : [body];
        const data = rows.filter(row => typeof row.display_name === 'string' && row.display_name.trim() &&
          ['string', 'number'].includes(typeof row.lat) && String(row.lat).trim() !== '' && ['string', 'number'].includes(typeof row.lon) && String(row.lon).trim() !== '' &&
          Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon)) && Math.abs(Number(row.lat)) <= 90 && Math.abs(Number(row.lon)) <= 180)
          .slice(0, kind === 'search' ? 5 : 1).map(row => ({ address: row.display_name.slice(0, 1000), latitude: Number(row.lat), longitude: Number(row.lon),
            street: String(row.address?.road || row.address?.pedestrian || row.address?.footway || row.address?.path || '').slice(0, 250),
            source: 'OpenStreetMap', attribution: '© OpenStreetMap contributors' }));
        const ttl = data.length ? 86400 : 60;
        if (cache.size >= 1000) cache.delete(cache.keys().next().value);
        cache.set(key, { until: now() + ttl * 1000, data });
        if (redis) await redis.set(key, JSON.stringify(data), { EX: ttl }).catch(() => {});
        return data;
      } finally { await release(); }
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  }
  return {
    search(text) {
      if (typeof text !== 'string' || text.trim().length < 3 || text.length > 500) throw failure('Isi alamat atau nama tempat, 3–500 karakter.', 400);
      return run('search', { q: text.trim().replace(/\s+/g, ' '), countrycodes: 'id', limit: 5 });
    },
    reverse(lat, lon) {
      const latitude = coordinate(lat, 90), longitude = coordinate(lon, 180);
      return run('reverse', { lat: latitude.toFixed(5), lon: longitude.toFixed(5), zoom: 18 });
    },
  };
}
let instance;
const service = () => instance || (instance = createGeocoder());
module.exports = { createGeocoder, service, coordinate };
