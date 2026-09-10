import { useState } from 'react';
import fotoSnapsLogo from '../../assets/landscape.jpg';

type Role = 'admin' | 'crew_event' | 'crew_store' | 'guest_crew';
type Page = string;

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

interface SidebarProps {
  role: Role;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  userName?: string;
  avatarUrl?: string;
}

const ic = {
  dashboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  crew: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  event: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  absensi: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  payroll: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  laporan: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  audit: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  inventory: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  box: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  recipe: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  truck: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m0 0h3l3 3v4h-3m0 0a2 2 0 11-4 0m4 0a2 2 0 01-4 0M6 17a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  cog: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  clipboard: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  send: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
  myEvent: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  riwayat: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  kertas: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  operasional: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

const adminNav: NavItem[] = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: ic.dashboard },
  { id: 'admin-crew', label: 'Kelola Crew', icon: ic.crew },
  { id: 'admin-event', label: 'Kelola Event', icon: ic.event },
  { id: 'admin-absensi', label: 'Absensi', icon: ic.absensi },
  { id: 'admin-payroll', label: 'Payroll', icon: ic.payroll },
  { id: 'admin-laporan', label: 'Laporan', icon: ic.laporan },
  { id: 'admin-audit', label: 'Audit Log', icon: ic.audit },
];

const crewEventNav: NavItem[] = [
  { id: 'ce-dashboard', label: 'Dashboard', icon: ic.dashboard },
  { id: 'ce-events', label: 'Event Saya', icon: ic.myEvent },
  { id: 'ce-absensi', label: 'Absensi', icon: ic.absensi },
  { id: 'ce-inventory', label: 'Inventory', icon: ic.inventory },
  { id: 'ce-operasional', label: 'Operasional', icon: ic.operasional },
  { id: 'ce-riwayat', label: 'Riwayat', icon: ic.riwayat },
  { id: 'ce-payroll', label: 'Payroll', icon: ic.payroll },
];

const crewStoreNav: NavItem[] = [
  { id: 'cs-dashboard', label: 'Dashboard', icon: ic.dashboard },
  { id: 'cs-absensi', label: 'Absensi', icon: ic.absensi },
  { id: 'cs-riwayat', label: 'Riwayat', icon: ic.riwayat },
  { id: 'cs-payroll', label: 'Payroll', icon: ic.payroll },
];

const guestCrewNav: NavItem[] = [
  { id: 'guest-portal', label: 'Absensi Darurat', icon: ic.absensi },
  { id: 'guest-info', label: 'Event Hari Ini', icon: ic.myEvent },
  { id: 'guest-help', label: 'Pusat Bantuan', icon: ic.cog },
];

const navMap: Record<Role, NavItem[]> = {
  admin: adminNav,
  crew_event: crewEventNav,
  crew_store: crewStoreNav,
  guest_crew: guestCrewNav,
};

const roleLabel: Record<Role, string> = {
  admin: 'Administrator',
  crew_event: 'Crew Event',
  crew_store: 'Crew Store',
  guest_crew: 'Guest Crew',
};

const roleBadge: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800',
  crew_event: 'bg-blue-100 text-blue-800',
  crew_store: 'bg-emerald-100 text-emerald-800',
  guest_crew: 'bg-amber-100 text-amber-800',
};

function NavItemRow({
  item,
  currentPage,
  onNavigate,
  collapsed,
  depth = 0,
  compact = false,
}: {
  item: NavItem;
  currentPage: string;
  onNavigate: (p: string) => void;
  collapsed: boolean;
  depth?: number;
  compact?: boolean;
}) {
  const hasChildren = !!item.children?.length;
  const isGroupActive = hasChildren && item.children!.some(c => c.id === currentPage);
  const [open, setOpen] = useState(isGroupActive);
  const isActive = currentPage === item.id || (item.id === 'ce-events' && currentPage === 'ce-workflow');

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => { if (!collapsed) setOpen(o => !o); }}
          title={collapsed ? item.label : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all
            ${isGroupActive ? 'text-blue-300 bg-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-left">{item.label}</span>
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {/* Sub-items */}
        {!collapsed && open && (
          <div className="ml-3 pl-3 border-l border-white/10 mb-1 space-y-0.5">
            {item.children!.map(child => (
              <button
                key={child.id}
                onClick={() => onNavigate(child.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all
                  ${currentPage === child.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
              >
                <span className="flex-shrink-0 opacity-75">{child.icon}</span>
                <span className="truncate">{child.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={`relative w-full flex items-center px-3 mb-0.5 font-medium transition-all ${compact ? 'gap-2 py-1.5 rounded-full text-xs' : 'gap-3 py-2.5 rounded-xl text-sm'}
        ${isActive ? 'bg-blue-600 text-white' : ''}`}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

export default function Sidebar({ role, currentPage, onNavigate, collapsed, onToggle, mobileOpen = false, onCloseMobile, userName = 'Pengguna', avatarUrl }: SidebarProps) {
  const nav = navMap[role];

  const handleNavigate = (page: string) => {
    onNavigate(page);
    onCloseMobile?.();
  };

  const SidebarContent = ({ forceExpanded = false }: { forceExpanded?: boolean }) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    return (
      <>
        {/* Logo */}
        <div className={`flex items-center border-b border-white/5 flex-shrink-0 h-16 ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <button
            onClick={forceExpanded ? onCloseMobile : onToggle}
            className="w-14 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-300/80 dark:border-white/15 ring-1 ring-black/5 hover:border-slate-400 dark:hover:border-white/30 transition-all"
            title="Jawara"
          >
            <img src={fotoSnapsLogo} alt="Jawara" className="w-full h-full object-cover" />
          </button>
          {!isCollapsed && (
            <span className="sidebar-brand font-bold tracking-tight whitespace-nowrap overflow-hidden ml-3 text-lg">JAWARA</span>
          )}
          {forceExpanded && (
            <button onClick={onCloseMobile} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 md:hidden">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Role badge */}
        {!isCollapsed && (
          <div className={`flex-shrink-0 ${role === 'guest_crew' ? 'px-3 py-2' : 'px-4 py-3'}`}>
            <span className={`inline-flex items-center font-semibold ${role === 'guest_crew' ? 'px-2 py-0.5 rounded-full text-[10px]' : 'px-2.5 py-1 rounded-lg text-xs'} ${roleBadge[role]}`}>
              {roleLabel[role]}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {nav.map((item) => (
            <NavItemRow
              key={item.id}
              item={item}
              currentPage={currentPage}
              onNavigate={handleNavigate}
              collapsed={isCollapsed}
              compact={role === 'guest_crew'}
            />
          ))}
        </nav>
      </>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="app-sidebar hidden md:flex flex-col h-screen flex-shrink-0"
        style={{ width: collapsed ? 72 : role === 'guest_crew' ? 180 : 240, transition: 'width 0.2s ease' }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-fade-in"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`app-sidebar md:hidden fixed inset-y-0 left-0 z-50 w-[80vw] max-w-[280px] flex flex-col h-screen transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent forceExpanded />
      </aside>
    </>
  );
}
