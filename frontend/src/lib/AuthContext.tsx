// Sesi login sekarang berasal dari Supabase Auth (bukan sistem JWT custom).
// Tidak ada lagi konsep tenant/memberships — backend langsung mengembalikan
// satu role per user (lihat backend/src/modules/auth/auth.controller.js).

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { ApiError, api } from './apiClient';
import { clearAuthSession, setAccessToken } from './authSession';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api';

// Role di database pakai UPPER_SNAKE_CASE, frontend pakai lower_snake_case.
export type FrontendRole = 'admin' | 'crew_event' | 'crew_store' | 'guest_crew';

const ROLE_DB_TO_FRONTEND: Record<string, FrontendRole> = {
  SUPER_ADMIN: 'admin',
  ADMIN_STORE: 'admin',
  EVENT_MANAGER: 'admin',
  CREW_EVENT: 'crew_event',
  CREW_STORE: 'crew_store',
  GUEST_CREW: 'guest_crew',
};

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  isGuest?: boolean;
  avatarUrl?: string;
  pendingEmail?: string;
  phone_number?: string;
}

export interface AuthState {
  token: string;
  refreshToken: string;
  user: AuthUser;
  role: string; // role code dari database, mis. 'CREW_EVENT' atau 'GUEST_CREW'
}

interface AuthContextValue {
  auth: AuthState | null;
  frontendRole: FrontendRole | null;
  login: (email: string, password: string) => Promise<void>;
  loginAsGuest: (guestInfo: { name: string; phone: string }) => void;
  logout: () => void;
  updateProfile: (patch: Partial<AuthUser>) => void;
  refreshProfile: () => Promise<void>;
  loading: boolean;
  error: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sessionVersion = useRef(0);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'X-FotoSnaps-Request': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();

      if (!res.ok) throw new ApiError(body?.message || 'Login gagal.', res.status);

      if (!body.token || !body.user?.id || !ROLE_DB_TO_FRONTEND[body.role] || body.role === 'GUEST_CREW') {
        throw new ApiError('Respons login tidak valid. Silakan hubungi admin.', 502);
      }

      const nextAuth: AuthState = {
        token: body.token,
        refreshToken: body.refreshToken,
        user: body.user,
        role: body.role,
      };

      setAccessToken(nextAuth.token);
      setAuth(nextAuth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (auth?.token) void fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', headers: { 'X-FotoSnaps-Request': '1', Authorization: `Bearer ${auth.token}` } }).catch(() => {});
    sessionVersion.current++;
    clearAuthSession();
    setAuth(null);
  }, [auth?.token]);

  const loginAsGuest = useCallback((guestInfo: { name: string; phone: string }) => {
    sessionVersion.current++;
    const nextAuth: AuthState = {
      token: '',
      refreshToken: '',
      user: {
        id: `guest_${crypto.randomUUID()}`,
        full_name: guestInfo.name.trim() || 'Guest Crew',
        email: '',
        phone: guestInfo.phone.trim(),
        isGuest: true,
      },
      role: 'GUEST_CREW',
    };
    clearAuthSession();
    setAuth(nextAuth);
  }, []);

  const updateProfile = useCallback((patch: Partial<AuthUser>) => {
    setAuth(current => current && current.user.id === auth?.user.id ? { ...current, user: { ...current.user, ...patch, id: current.user.id, isGuest: current.user.isGuest } } : current);
  }, [auth?.user.id]);
  const refreshProfile = useCallback(async () => {
    if (!auth || auth.role === 'GUEST_CREW') return;
    const version = sessionVersion.current;
    const user = await api.get<AuthUser>('/users/me');
    if (version === sessionVersion.current) updateProfile(user);
  }, [auth?.user.id, auth?.role, updateProfile]);

  const frontendRole = auth ? ROLE_DB_TO_FRONTEND[auth.role] ?? null : null;

  return (
    <AuthContext.Provider value={{ auth, frontendRole, login, loginAsGuest, logout, updateProfile, refreshProfile, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
