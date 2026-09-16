import {t as translateUI} from '../../lib/i18n';
import LanguageSelect from '../../components/ui/LanguageSelect';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { usePreferences } from '../../lib/PreferencesContext';
export default function SettingsPage({ onLogout, onProfile }: { onLogout: () => void; onProfile: () => void }) {
  const { auth } = useAuth();
  const { theme, setTheme, badges, setBadges } = usePreferences();
  const [camera, setCamera] = useState('Belum diperiksa');
  const [location, setLocation] = useState('Belum diperiksa');
  const [checking, setChecking] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function checkCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCamera('Gunakan HTTPS atau localhost agar kamera tersedia.'); return; }
    setChecking('camera');
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); stream.getTracks().forEach(t => t.stop()); if (alive.current) setCamera('Kamera dapat diakses. Kamera sudah dimatikan kembali.'); }
    catch { if (alive.current) setCamera('Kamera tidak tersedia atau izin ditolak. Periksa izin situs pada browser.'); }
    finally { if (alive.current) setChecking(''); }
  }
  function checkLocation() {
    if (!window.isSecureContext || !navigator.geolocation) { setLocation('Gunakan HTTPS atau localhost agar lokasi tersedia.'); return; }
    setChecking('location');
    navigator.geolocation.getCurrentPosition(() => { if (alive.current) { setLocation('Lokasi dapat diakses. Koordinat uji tidak disimpan atau dikirim.'); setChecking(''); } }, () => { if (alive.current) { setLocation('Lokasi tidak tersedia atau izin ditolak. Periksa izin situs pada browser.'); setChecking(''); } }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  return <div className="account-page"><div className="account-heading"><span className="ui-eyebrow">{translateUI("PREFERENSI APLIKASI")}</span><h2>{translateUI("Pengaturan")}</h2><p>{translateUI("Atur tampilan dan periksa kesiapan perangkat Anda.")}</p></div>
    <section className="ui-card settings-row"><div><h3>{translateUI("Bahasa aplikasi")}</h3><p>{translateUI("Pilihan bahasa tersimpan pada browser ini.")}</p></div><LanguageSelect /></section>
    <section className="ui-card space-y-4"><div><h3>{translateUI("Tampilan")}</h3><p>{translateUI("Tema berlaku di seluruh aplikasi dan tersimpan pada browser ini.")}</p></div><div className="theme-options">
      <button className={`theme-choice ${theme === 'light' ? 'selected' : ''}`} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><span className="theme-preview light-preview" aria-hidden="true"><i /><i /><i /></span><strong>{translateUI("Terang")}</strong><span>{translateUI("Latar putih, teks biru gelap")}</span></button>
      <button className={`theme-choice ${theme === 'dark' ? 'selected' : ''}`} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><span className="theme-preview dark-preview" aria-hidden="true"><i /><i /><i /></span><strong>{translateUI("Gelap")}</strong><span>{translateUI("Latar biru malam, teks putih")}</span></button>
    </div></section>
    <section className="ui-card settings-row"><div><h3>{translateUI("Badge notifikasi")}</h3><p>{translateUI("Tampilkan jumlah notifikasi belum dibaca pada ikon lonceng. Daftar notifikasi tetap dapat dibuka saat badge dimatikan.")}</p></div><button role="switch" aria-checked={badges} aria-label={translateUI("Tampilkan badge notifikasi")} className={`ui-switch ${badges ? 'on' : ''}`} onClick={() => setBadges(!badges)}><span /></button></section>
    <section className="ui-card space-y-5"><div><h3>{translateUI("Izin perangkat")}</h3><p>{translateUI("Izin kamera dan lokasi dikelola oleh browser. Pemeriksaan hanya berjalan saat Anda menekan tombol.")}</p></div>
      <div className="settings-row"><div><h4>{translateUI("Kamera")}</h4><p role="status">{translateUI(camera)}</p></div><button className="ui-button-secondary" disabled={!!checking} onClick={checkCamera}>{checking === 'camera' ? translateUI("Memeriksa…") : translateUI("Periksa kamera")}</button></div>
      <div className="settings-row"><div><h4>{translateUI("Lokasi")}</h4><p role="status">{translateUI(location)}</p></div><button className="ui-button-secondary" disabled={!!checking} onClick={checkLocation}>{checking === 'location' ? translateUI("Memeriksa…") : translateUI("Periksa lokasi")}</button></div>
    </section>
    <section className="ui-card space-y-4"><h3>{translateUI("Akun dan keamanan")}</h3><p>{auth?.role === 'GUEST_CREW' ? translateUI("Profil guest hanya tersimpan dalam sesi aktif. Keluar atau memuat ulang aplikasi akan menghapus profil sesi ini.") : translateUI("Ubah identitas dan email melalui Profil Saya. Untuk mengganti password, keluar lalu pilih Lupa Sandi pada halaman login.")}</p><div className="flex flex-wrap gap-3"><button className="ui-button-secondary" onClick={onProfile}>{translateUI("Buka Profil Saya")}</button><button className="ui-button-danger" onClick={onLogout}>{translateUI("Keluar dari aplikasi")}</button></div></section>
  </div>;
}
