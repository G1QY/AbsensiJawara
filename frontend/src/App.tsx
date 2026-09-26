import {t as translateUI, useLanguage} from './lib/i18n';
import LanguageSelect from './components/ui/LanguageSelect';
import { useCallback, useEffect, useState } from 'react';
import EventManagerWorkspace from './pages/eventManager/EventManagerWorkspace';
import StaffWorkspace from './pages/staff/StaffWorkspace';
import type {FrontendRole as Role} from './lib/AuthContext';
import {accountRoles} from './lib/accountRoles';
import AccountsWorkspace from './pages/admin/AccountsWorkspace';
import HeadStoreWorkspace from './pages/headStore/HeadStoreWorkspace';
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
import PersonalPayroll from './pages/payroll/PersonalPayroll';
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

type Toast = { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' };

const pageMeta: Record<string, { breadcrumbs: string[]; title: string }> = {
  'em-dashboard': {breadcrumbs:['JAWARA','Event Manager'],title:'Dashboard Event'},
  'em-events': {breadcrumbs:['JAWARA','Event Manager'],title:'Kelola Event'},
  'em-crew': {breadcrumbs:['JAWARA','Event Manager'],title:'Crew Event'},
  'em-attendance': {breadcrumbs:['JAWARA','Event Manager'],title:'Absensi Event'},
  'em-reports': {breadcrumbs:['JAWARA','Event Manager'],title:'Rekap Event'},
  'admin-accounts': { breadcrumbs: ['JAWARA', 'Super Admin'], title: 'Akun & Hak Akses' },
  'hs-dashboard': { breadcrumbs: ['JAWARA', 'Head Store'], title: 'Monitoring Kota' },
  'hs-crew': { breadcrumbs: ['JAWARA', 'Head Store'], title: 'Crew per Cabang' },
  'hs-attendance': { breadcrumbs: ['JAWARA', 'Head Store'], title: 'Absensi Kota' },
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
  if (['head_office','office_staff','production_staff'].includes(role)) return 'staff-dashboard';
  if (role === 'event_manager') return 'em-dashboard';
  if (role === 'head_store') return 'hs-dashboard';
  if (role === 'admin') return 'admin-crew';
  if (role === 'crew_event') return 'ce-dashboard';
  return 'cs-dashboard';
}

export default function App() {
  useLanguage();
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
    addToast(translateUI('Berhasil masuk ke JAWARA'));
  }, [frontendRole, addToast]);

  if (!auth || !frontendRole) {
    return (
      <>
        <div className="login-theme-toggle flex items-center gap-2"><LanguageSelect compact /><ThemeToggle /></div>
        <LoginPage />
        <ToastContainer toasts={toasts} onRemove={id => setToasts(items => items.filter(item => item.id !== id))} />
      </>
    );
  }

  const role = frontendRole as Role;
  // Do not briefly mount an admin screen while the role-change effect runs.
  const prefix = role === 'guest_crew' ? 'guest-' : role === 'event_manager' ? 'em-' : role === 'head_store' ? 'hs-' : ['head_office','office_staff','production_staff'].includes(role) ? 'staff-' : role === 'admin' ? 'admin-' : role === 'crew_event' ? 'ce-' : 'cs-';
  const activePage = ['account-profile', 'account-settings'].includes(currentPage) || currentPage.startsWith(prefix) ? currentPage : defaultPage(role);
  const personalPayroll = ['em-my-payroll','admin-my-payroll','hs-my-payroll','staff-payroll'].includes(activePage);
  const personalPage = ['em-my-attendance','admin-my-attendance','hs-my-attendance','staff-absensi'].includes(activePage);
  const personalHistory = ['em-my-history','admin-my-history','hs-my-history','staff-riwayat'].includes(activePage);
  const meta = (personalPayroll || personalPage || personalHistory || activePage==='staff-dashboard') ? {breadcrumbs:['JAWARA',accountRoles[auth.role]||auth.role],title:personalPayroll?'Payroll Saya':personalPage?'Absensi Saya':personalHistory?'Riwayat Saya':'Dashboard'} : activePage.startsWith('account-') ? { breadcrumbs: ['JAWARA', role === 'guest_crew' ? 'Guest Mode' : 'Akun'], title: activePage === 'account-profile' ? 'Profil Saya' : 'Pengaturan' } : pageMeta[activePage] || pageMeta[defaultPage(role)];
  const navigate = (page: string) => {
    setCurrentPage(page);
    setMobileNavOpen(false);
  };

  const renderContent = () => {
    if (activePage === 'account-profile') return <ProfilePage />;
    if (activePage === 'account-settings') return <SettingsPage onLogout={logout} onProfile={() => navigate('account-profile')} />;
    if (role === 'guest_crew') return <GuestCrewPortal page={activePage} onNavigate={navigate} />;
    if (personalPayroll && auth.role!=='SUPER_ADMIN') return <PersonalPayroll />;
    if (personalPage && auth.role!=='SUPER_ADMIN') return <CrewAttendance />;
    if (personalHistory && auth.role!=='SUPER_ADMIN') return <AttendanceHistory showAttendance={false} />;
    if (['head_office','office_staff','production_staff'].includes(role)) return <StaffWorkspace onAttendance={()=>navigate('staff-absensi')} onHistory={()=>navigate('staff-riwayat')} />;
    if (role === 'event_manager') {
      if (activePage === 'em-events') return <EventWorkspace onAttendance={()=>navigate('em-attendance')} />;
      if (activePage === 'em-attendance') return <AdminAbsensi eventOnly />;
      return <EventManagerWorkspace page={activePage} onNavigate={navigate} />;
    }
    if (role === 'head_store') return <HeadStoreWorkspace page={activePage} />;
    switch (activePage) {
      case 'admin-accounts': return <AccountsWorkspace />;
      case 'admin-dashboard': return <DashboardWorkspace />;
      case 'admin-event': return <EventWorkspace onAttendance={() => navigate('admin-absensi')} onPayroll={() => navigate('admin-payroll')} />;
      case 'admin-payroll': return auth.role==='SUPER_ADMIN'?<PayrollWorkspace onAttendance={()=>navigate('admin-absensi')} />:<PersonalPayroll />;
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
      </div>
      <ToastContainer toasts={toasts} onRemove={id => setToasts(items => items.filter(item => item.id !== id))} />
    </div>
  );
}
