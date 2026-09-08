import { useEffect, useRef, useState } from 'react';
import Avatar from '../ui/Avatar';
import ThemeToggle from '../ui/ThemeToggle';
import { useNotifications } from '../../lib/NotificationsContext';
import { usePreferences } from '../../lib/PreferencesContext';
type Role = 'admin' | 'crew_event' | 'crew_store' | 'guest_crew';
interface TopNavProps { breadcrumbs: string[]; title: string; role: Role; onLogout: () => void; onOpenMobileNav: () => void; onProfile: () => void; onSettings: () => void; userName: string; userEmail: string; avatarUrl?: string; }
const labels: Record<Role, string> = { admin: 'Administrator', crew_event: 'Crew Event', crew_store: 'Crew Store', guest_crew: 'Guest Crew' };
export default function TopNav({ breadcrumbs, title, role, onLogout, onOpenMobileNav, onProfile, onSettings, userName, userEmail, avatarUrl }: TopNavProps) {
  const [panel, setPanel] = useState<'profile' | 'notifications' | null>(null);
  const [now, setNow] = useState(() => new Date());
  const profileButton = useRef<HTMLButtonElement>(null);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const { items, error, loading, refresh, markRead, markAll } = useNotifications();
  const { badges } = usePreferences();
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!panel) return; const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPanel(null); (panel === 'profile' ? profileButton : notificationButton).current?.focus(); } }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [panel]);
  const unread = items.filter(n => !n.read_at).length;
  const date = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  const clock = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  return <header className="app-topbar">
    <button className="ui-icon md:hidden" type="button" aria-label="Buka menu" onClick={onOpenMobileNav}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg></button>
    <div className="flex-1 min-w-0"><nav aria-label="Breadcrumb" className="topbar-crumbs">{breadcrumbs.join(' › ')}</nav><h1 className="topbar-title truncate">{title}</h1></div>
    <time dateTime={now.toISOString()} title="Waktu Indonesia Barat" className="topbar-time hidden xl:block">{date} • {clock} WIB</time>
    <ThemeToggle />
    <button ref={notificationButton} type="button" className="ui-icon relative" aria-label="Notifikasi" aria-expanded={panel === 'notifications'} aria-controls="notification-panel" onClick={() => { setPanel(panel === 'notifications' ? null : 'notifications'); if (panel !== 'notifications') refresh(); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{badges && unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}</button>
    <button ref={profileButton} type="button" className="profile-trigger" aria-label="Buka menu profil" aria-expanded={panel === 'profile'} aria-controls="profile-panel" onClick={() => setPanel(panel === 'profile' ? null : 'profile')}><Avatar name={userName} src={avatarUrl} /><span className="hidden lg:block text-left min-w-0"><strong className="block truncate max-w-44 text-xs">{userName}</strong><span className="block text-[11px] ui-muted">{labels[role]}</span></span><span className="hidden sm:block" aria-hidden="true">⌄</span></button>
    {panel && <><div className="fixed inset-0 z-40" onClick={() => setPanel(null)} aria-hidden="true" />
      {panel === 'profile' ? <section id="profile-panel" aria-label="Menu profil" className="topbar-panel"><div className="panel-heading"><strong className="block break-words">{userName}</strong><p className="break-all">{userEmail || 'Sesi Guest Crew'}</p></div><div className="p-2 space-y-1"><button className="panel-action" onClick={() => { setPanel(null); onProfile(); }}>Profil Saya</button><button className="panel-action" onClick={() => { setPanel(null); onSettings(); }}>Pengaturan</button><button className="panel-action ui-danger-text" onClick={() => { setPanel(null); onLogout(); }}>Keluar</button></div></section>
      : <section id="notification-panel" aria-label="Daftar notifikasi" className="topbar-panel notification-panel"><div className="panel-heading flex items-center justify-between gap-3"><strong>Notifikasi</strong><button className="ui-link text-xs" disabled={!unread || loading} onClick={() => void markAll()}>Tandai dibaca</button></div>
        <div className="max-h-80 overflow-y-auto">{loading && <p className="p-4" role="status">Memuat notifikasi…</p>}{error && <div className="p-4 space-y-2"><p className="ui-error" role="alert">{error}</p><button className="ui-link" onClick={refresh}>Coba lagi</button></div>}
        {!loading && !error && items.length === 0 && <div className="p-5"><strong>Belum ada notifikasi</strong><p className="ui-muted text-sm mt-2">{role === 'guest_crew' ? 'Pemberitahuan hanya berasal dari aktivitas sesi guest Anda.' : 'Notifikasi untuk akun Anda akan muncul di sini.'}</p></div>}
        {items.map(n => <button className={`notification-row ${n.read_at ? '' : 'unread'}`} key={n.id} onClick={() => void markRead(n.id)}><strong>{n.title}</strong>{n.body && <p>{n.body}</p>}<time>{new Date(n.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</time></button>)}</div>
      </section>}
    </>}
  </header>;
}
