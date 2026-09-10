import MobileNav from './components/layout/MobileNav';
import { useCallback, useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import { useAuth } from './lib/AuthContext';
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';
import { ToastContainer } from './components/ui/Toast';
import KelolaCrew from './pages/admin/KelolaCrew';
import AdminPages from './pages/admin/AdminPages';
import EventWorkspace from './pages/admin/EventWorkspace';
import DashboardWorkspace from './pages/admin/DashboardWorkspace';
import PayrollWorkspace from './pages/admin/PayrollWorkspace';
import AdminAbsensi from './pages/admin/AdminAbsensi';
import CrewAttendance from './pages/crewStore/CrewStoreAbsensi';
import AttendanceHistory from './pages/crewEvent/CeAbsensi';
import ProfilePage from './pages/account/ProfilePage';
import SettingsPage from './pages/account/SettingsPage';
import ThemeToggle from './components/ui/ThemeToggle';
import GuestCrewPortal from './pages/guest/GuestCrewPortal';
import CrewEventDashboard from './pages/crewEvent/CrewEventDashboard';
import CrewEventEvents from './pages/crewEvent/CrewEventEvents';
import CeInventory from './pages/crewEvent/CeInventory';
import CeOperasional from './pages/crewEvent/CeOperasional';
import CrewEventPayroll from './pages/crewEvent/CrewEventPayroll';
import CrewStoreDashboard from './pages/crewStore/CrewStoreDashboard';
import CrewStorePayroll from './pages/crewStore/CrewStorePayroll';

type Role = 'admin' | 'crew_event' | 'crew_store' | 'guest_crew';
type Toast = { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' };

const pageMeta: Record<string, { breadcrumbs: string[]; title: string }> = {
  'admin-dashboard': { breadcrumbs: ['Jawara', 'Admin'], title: 'Dashboard' },
  'admin-event': { breadcrumbs: ['Jawara', 'Admin'], title: 'Kelola Event' },
  'admin-payroll': { breadcrumbs: ['Jawara', 'Admin'], title: 'Payroll' },
  'admin-laporan': { breadcrumbs: ['Jawara', 'Admin'], title: 'Laporan' },
  'admin-audit': { breadcrumbs: ['Jawara', 'Admin'], title: 'Audit Log' },
  'admin-crew': { breadcrumbs: ['Jawara', 'Admin'], title: 'Kelola Crew' },
  'admin-absensi': { breadcrumbs: ['Jawara', 'Admin'], title: 'Manajemen Absensi' },
  'ce-absensi': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Absensi Hari Ini' },
  'ce-dashboard': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Dashboard' },
  'ce-events': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Event Saya' },
  'ce-workflow': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Workflow Event' },
  'ce-inventory': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Inventory Event' },
  'ce-operasional': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Operasional Event' },
  'ce-payroll': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Payroll' },
  'ce-riwayat': { breadcrumbs: ['Jawara', 'Crew Event'], title: 'Riwayat Absensi' },
  'cs-absensi': { breadcrumbs: ['Jawara', 'Crew Store'], title: 'Absensi Hari Ini' },
  'cs-dashboard': { breadcrumbs: ['Jawara', 'Crew Store'], title: 'Dashboard' },
  'cs-riwayat': { breadcrumbs: ['Jawara', 'Crew Store'], title: 'Riwayat Absensi' },
  'cs-payroll': { breadcrumbs: ['Jawara', 'Crew Store'], title: 'Payroll' },
  'guest-portal': { breadcrumbs: ['Jawara', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
  'guest-info': { breadcrumbs: ['Jawara', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
  'guest-help': { breadcrumbs: ['Jawara', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
  'admin-dashboard': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Dashboard' },
  'admin-event': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Kelola Event' },
  'admin-payroll': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Payroll' },
  'admin-laporan': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Laporan' },
  'admin-audit': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Audit Log' },
  'admin-crew': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Kelola Crew' },
  'admin-absensi': { breadcrumbs: ['JAWARA', 'Admin'], title: 'Manajemen Absensi' },
  'ce-absensi': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Absensi Hari Ini' },
  'ce-dashboard': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Dashboard' },
  'ce-events': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Event Saya' },
  'ce-workflow': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Workflow Event' },
  'ce-inventory': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Inventory Event' },
  'ce-operasional': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Operasional Event' },
  'ce-payroll': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Payroll' },
  'ce-riwayat': { breadcrumbs: ['JAWARA', 'Crew Event'], title: 'Riwayat Absensi' },
  'cs-absensi': { breadcrumbs: ['JAWARA', 'Crew Store'], title: 'Absensi Hari Ini' },
  'cs-dashboard': { breadcrumbs: ['JAWARA', 'Crew Store'], title: 'Dashboard' },
  'cs-riwayat': { breadcrumbs: ['JAWARA', 'Crew Store'], title: 'Riwayat Absensi' },
  'cs-payroll': { breadcrumbs: ['JAWARA', 'Crew Store'], title: 'Payroll' },
  'guest-portal': { breadcrumbs: ['JAWARA', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
  'guest-info': { breadcrumbs: ['JAWARA', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
  'guest-help': { breadcrumbs: ['JAWARA', 'Guest Mode'], title: 'Portal Absensi Guest Crew' },
};

function defaultPage(role: Role): string {
  if (role === 'guest_crew') return 'guest-portal';
  if (role === 'admin') return 'admin-crew';
  if (role === 'crew_event') return 'ce-dashboard';
  return 'cs-dashboard';
}

export default function App() {
  const { auth, frontendRole, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('admin-crew');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    setToasts(items => [...items, { id: crypto.randomUUID(), message, type }]);
  }, []);

  useEffect(() => {
    if (!frontendRole) return;
    setCurrentPage(defaultPage(frontendRole));
    setSidebarCollapsed(false);
    setMobileNavOpen(false);
    addToast('Berhasil masuk ke Jawara');
    addToast('Berhasil masuk ke JAWARA');
  }, [frontendRole, addToast]);

  if (!auth || !frontendRole) {
    return (
      <>
        <div className="login-theme-toggle"><ThemeToggle /></div>
        <LoginPage />
        <ToastContainer toasts={toasts} onRemove={id => setToasts(items => items.filter(item => item.id !== id))} />
      </>
    );
  }

  const role = frontendRole as Role;
  // Do not briefly mount an admin screen while the role-change effect runs.
  const prefix = role === 'guest_crew' ? 'guest-' : role === 'admin' ? 'admin-' : role === 'crew_event' ? 'ce-' : 'cs-';
  const activePage = ['account-profile', 'account-settings'].includes(currentPage) || currentPage.startsWith(prefix) ? currentPage : defaultPage(role);
  const meta = activePage.startsWith('account-') ? { breadcrumbs: ['Jawara', role === 'guest_crew' ? 'Guest Mode' : 'Akun'], title: activePage === 'account-profile' ? 'Profil Saya' : 'Pengaturan' } : pageMeta[activePage] || pageMeta[defaultPage(role)];
  const meta = activePage.startsWith('account-') ? { breadcrumbs: ['JAWARA', role === 'guest_crew' ? 'Guest Mode' : 'Akun'], title: activePage === 'account-profile' ? 'Profil Saya' : 'Pengaturan' } : pageMeta[activePage] || pageMeta[defaultPage(role)];
  const navigate = (page: string) => {
    setCurrentPage(page);
    setMobileNavOpen(false);
  };

  const renderContent = () => {
    if (activePage === 'account-profile') return <ProfilePage />;
    if (activePage === 'account-settings') return <SettingsPage onLogout={logout} onProfile={() => navigate('account-profile')} />;
    if (role === 'guest_crew') return <GuestCrewPortal page={activePage} onNavigate={navigate} />;
    switch (activePage) {
      case 'admin-dashboard': return <DashboardWorkspace />;
      case 'admin-event': return <EventWorkspace onAttendance={() => navigate('admin-absensi')} onPayroll={() => navigate('admin-payroll')} />;
      case 'admin-payroll': return <PayrollWorkspace />;
      case 'admin-laporan':
      case 'admin-audit': return <AdminPages key={activePage} page={activePage} onNavigate={navigate} />;
      case 'admin-crew': return <KelolaCrew />;
      case 'admin-absensi': return <AdminAbsensi />;
      case 'ce-dashboard': return <CrewEventDashboard onStartWorkflow={() => navigate('ce-workflow')} />;
      case 'ce-events': return <CrewEventEvents />;
      case 'ce-workflow': return <CrewEventEvents autoOpen onCloseWorkflow={() => navigate('ce-events')} />;
      case 'ce-inventory': return <CeInventory />;
      case 'ce-operasional': return <CeOperasional />;
      case 'ce-payroll': return <CrewEventPayroll />;
      case 'cs-dashboard': return <CrewStoreDashboard onGoAbsensi={() => navigate('cs-absensi')} onGoRiwayat={() => navigate('cs-riwayat')} />;
      case 'cs-payroll': return <CrewStorePayroll />;
      case 'ce-absensi':
      case 'cs-absensi': return <CrewAttendance />;
      case 'ce-riwayat':
      case 'cs-riwayat': return <AttendanceHistory showAttendance={false} />;
      default: return role === 'admin' ? <KelolaCrew /> : <CrewAttendance />;
    }
  };

  return (
    <div className={`app-shell flex h-screen overflow-hidden ${role === 'guest_crew' ? 'bg-slate-100' : 'bg-slate-50'}`}>
      <Sidebar
        role={role}
        currentPage={activePage}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(value => !value)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        userName={auth.user.full_name}
        avatarUrl={auth.user.avatarUrl}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopNav
          breadcrumbs={meta.breadcrumbs}
          title={meta.title}
          role={role}
          onLogout={() => {
            logout();
            setCurrentPage('admin-crew');
          }}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          userName={auth.user.full_name}
          userEmail={auth.user.email}
          avatarUrl={auth.user.avatarUrl}
          onProfile={() => navigate('account-profile')}
          onSettings={() => navigate('account-settings')}
        />
        <main key={activePage} className={`employee-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${role !== 'admin' ? 'employee-mobile' : ''}`}>{renderContent()}</main>
        <MobileNav role={role} currentPage={activePage} onNavigate={navigate} onMenu={() => setMobileNavOpen(true)} menuOpen={mobileNavOpen} />
      </div>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(items => items.filter(item => item.id !== id))} />
    </div>
  );
}
