import { api, ApiError } from './apiClient';
export type AddressResult = { address: string; latitude: number; longitude: number; street: string; source: string; attribution: string };
export async function searchAddress(text: string): Promise<AddressResult[]> {
  return (await api.post<{ results: AddressResult[] }>('/locations/search', { text }, { signal: AbortSignal.timeout(12000) })).results;
}
const cache = new Map<string, { until: number; result: AddressResult | null }>();
const pending = new Map<string, Promise<AddressResult | null>>();
export function addressLookupError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return 'Pencarian alamat sedang ramai. Tunggu sebentar lalu coba lagi. Koordinat GPS tetap tercatat.';
  if (error instanceof ApiError && [401, 403].includes(error.status)) return 'Pencarian alamat tidak diizinkan. Periksa sesi login atau hubungi admin. Koordinat GPS tetap tercatat.';
  return 'Layanan alamat belum dapat dihubungi. Coba cari alamat lagi. Koordinat GPS tetap tercatat.';
}
export function reverseAddress(latitude: number, longitude: number, scope: boolean | 'attendance' = false, forceRefresh = false): Promise<AddressResult | null> {
  const key = `${scope}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (!forceRefresh && cached && cached.until > Date.now()) return Promise.resolve(cached.result);
  if (pending.has(key)) return pending.get(key)!;
  const path = scope === 'attendance' ? '/attendance/location' : scope ? '/guest-location/reverse' : '/locations/reverse';
  const request = api.post<{ results: AddressResult[] }>(path,
    { latitude, longitude }, { auth: scope !== true, signal: AbortSignal.timeout(25000) }).then(data => {
      const result = data.results[0] || null;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + (result ? 300000 : 30000), result });
      return result;
    }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
