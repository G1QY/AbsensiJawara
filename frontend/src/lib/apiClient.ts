// Lapisan komunikasi ke backend Express (lihat ../../../backend).
// Semua request otomatis menyertakan JWT (Authorization) dari Supabase Auth.
// TIDAK ADA lagi X-Tenant-Id — database FotoSnaps sudah berdiri sendiri.
import { clearAuthSession, getAccessToken } from './authSession';

// Prefix /api ditambahkan sekali di sini — semua endpoint backend sekarang
// terdaftar di bawah /api (lihat backend/src/app.js), jadi seluruh halaman
// yang pakai api.get/post/patch otomatis ikut tanpa perlu diedit satu-satu.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean; // default true — set false untuk endpoint publik (mis. /auth/login)
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = { 'X-FotoSnaps-Request': '1', 'Content-Type': 'application/json', ...(headers as Record<string, string>) };

  if (auth) {
    const token = getAccessToken();
    if (!token) throw new ApiError('Belum login.', 401);
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, headers: finalHeaders });

  if (auth && res.status === 401) {
    clearAuthSession();
    window.location.reload(); // paksa kembali ke Login
    throw new ApiError('Sesi berakhir, silakan login kembali.', 401);
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.message || `Request gagal (${res.status})`, res.status);
  }

  return body as T;
}

export const api = {
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, ...opts }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),

  /** Untuk endpoint yang menerima file (mis. foto absensi) — pakai FormData, jangan set Content-Type manual. */
  postForm: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getAccessToken();
    if (!token) throw new ApiError('Belum login.', 401);

    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'X-FotoSnaps-Request': '1', Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.status === 401) {
      clearAuthSession();
      window.location.reload();
      throw new ApiError('Sesi berakhir, silakan login kembali.', 401);
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(body?.message || `Request gagal (${res.status})`, res.status);
    return body as T;
  },
};
