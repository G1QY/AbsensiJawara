import { api } from './apiClient';
export type AddressResult = { address: string; latitude: number; longitude: number; street: string; source: string; attribution: string };
export async function searchAddress(text: string): Promise<AddressResult[]> {
  return (await api.post<{ results: AddressResult[] }>('/locations/search', { text }, { signal: AbortSignal.timeout(12000) })).results;
}
const cache = new Map<string, { until: number; result: AddressResult | null }>();
const pending = new Map<string, Promise<AddressResult | null>>();
export function reverseAddress(latitude: number, longitude: number, guest = false): Promise<AddressResult | null> {
  const key = `${guest}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.result);
  if (pending.has(key)) return pending.get(key)!;
  const request = api.post<{ results: AddressResult[] }>(guest ? '/guest-location/reverse' : '/locations/reverse',
    { latitude, longitude }, { auth: !guest, signal: AbortSignal.timeout(12000) }).then(data => {
      const result = data.results[0] || null;
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { until: Date.now() + (result ? 300000 : 30000), result });
      return result;
    }).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
