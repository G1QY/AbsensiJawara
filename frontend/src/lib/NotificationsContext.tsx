import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { api } from './apiClient';
export type AppNotification = { id: string; title: string; body?: string; created_at: string; read_at: string | null };
const Context = createContext<{ items: AppNotification[]; error: string; loading: boolean; refresh: () => void; markRead: (id: string) => Promise<void>; markAll: () => Promise<void>; add: (title: string, body: string) => void } | null>(null);
export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const owner = auth?.user.id || '';
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const [state, setState] = useState<{ owner: string; items: AppNotification[]; error: string; loading: boolean }>({ owner, items: [], error: '', loading: false });
  const guest = auth?.role === 'GUEST_CREW';
  async function refresh() {
    if (!owner || guest) return;
    setState(s => ({ owner, items: s.owner === owner ? s.items : [], error: '', loading: true }));
    try { const items = await api.get<AppNotification[]>('/notifications'); if (ownerRef.current === owner) setState({ owner, items, error: '', loading: false }); }
    catch (error) { if (ownerRef.current === owner) setState(s => ({ ...s, loading: false, error: error instanceof Error ? error.message : 'Notifikasi belum dapat dimuat.' })); }
  }
  useEffect(() => { setState({ owner, items: [], error: '', loading: false }); void refresh(); }, [owner]);
  const items = state.owner === owner ? state.items : [];
  async function markRead(id: string) {
    if (!items.some(n => n.id === id)) return;
    try {
      if (!guest) await api.patch(`/notifications/${id}/read`);
      if (ownerRef.current === owner) setState(s => ({ ...s, items: s.items.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n) }));
    } catch (error) { if (ownerRef.current === owner) setState(s => ({ ...s, error: error instanceof Error ? error.message : 'Gagal menandai notifikasi.' })); }
  }
  async function markAll() { for (const n of items.filter(n => !n.read_at)) await markRead(n.id); }
  function add(title: string, body: string) {
    if (!guest || !owner) return;
    setState(s => ({ owner, loading: false, error: '', items: [{ id: crypto.randomUUID(), title, body, created_at: new Date().toISOString(), read_at: null }, ...(s.owner === owner ? s.items : [])].slice(0, 50) }));
  }
  return <Context.Provider value={{ items, error: state.owner === owner ? state.error : '', loading: state.owner === owner && state.loading, refresh, markRead, markAll, add }}>{children}</Context.Provider>;
}
export function useNotifications() { const value = useContext(Context); if (!value) throw new Error('NotificationsProvider belum terpasang.'); return value; }
