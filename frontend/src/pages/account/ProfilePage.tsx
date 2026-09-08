import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useNotifications } from '../../lib/NotificationsContext';
import { api } from '../../lib/apiClient';
import Avatar from '../../components/ui/Avatar';

export default function ProfilePage() {
  const { auth, updateProfile, refreshProfile } = useAuth();
  const { add } = useNotifications();
  const guest = auth?.role === 'GUEST_CREW';
  const [name, setName] = useState(auth?.user.full_name || '');
  const [phone, setPhone] = useState(auth?.user.phone || auth?.user.phone_number || '');
  const [email, setEmail] = useState(auth?.user.email || '');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!guest);
  useEffect(() => { let alive = true; if (!guest) refreshProfile().catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  useEffect(() => { setName(auth?.user.full_name || ''); setPhone(auth?.user.phone || auth?.user.phone_number || ''); setEmail(auth?.user.email || ''); }, [auth?.user.full_name, auth?.user.phone, auth?.user.email]);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function perform(action: string, fn: () => Promise<string>) {
    if (busy) return;
    setBusy(action); setError(''); setMessage('');
    try { const text = await fn(); setMessage(text); if (guest) add('Profil diperbarui', text); }
    catch (e) { setError(e instanceof Error ? e.message : 'Perubahan belum tersimpan.'); }
    finally { setBusy(''); }
  }
  function saveProfile(e: FormEvent) {
    e.preventDefault();
    void perform('profile', async () => {
      if (name.trim().length < 2) throw new Error('Nama minimal dua karakter.');
      if (phone.trim() && !/^\+?[0-9 ()-]{7,30}$/.test(phone.trim())) throw new Error('Nomor telepon tidak valid.');
      if (guest) { updateProfile({ full_name: name.trim(), phone: phone.trim(), email: email.trim() }); return 'Profil guest diperbarui untuk sesi ini.'; }
      const result = await api.patch<{ full_name: string; phone: string }>('/users/me', { fullName: name, phone });
      updateProfile(result); return 'Nama dan nomor telepon berhasil disimpan ke akun Anda.';
    });
  }
  async function savePhoto() {
    if (!file) return;
    await perform('photo', async () => {
      if (guest) {
        const bitmap = await createImageBitmap(file);
        try { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Foto tidak dapat diproses.'); const size = Math.min(bitmap.width, bitmap.height); ctx.drawImage(bitmap, (bitmap.width-size)/2, (bitmap.height-size)/2, size, size, 0, 0, 512, 512); updateProfile({ avatarUrl: canvas.toDataURL('image/jpeg', 0.85) }); }
        finally { bitmap.close(); }
      } else { const data = new FormData(); data.append('photo', file); updateProfile(await api.postForm<{ avatarUrl: string }>('/users/me/avatar', data)); }
      setFile(null); return guest ? 'Foto profil disimpan untuk sesi guest ini.' : 'Foto profil berhasil disimpan.';
    });
  }
  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    await perform('email', async () => {
      const result = await api.post<{ pendingEmail: string; message: string }>('/users/me/email', { email, currentPassword: password });
      updateProfile({ pendingEmail: result.pendingEmail }); setPassword(''); return result.message;
    });
  }
  return <div className="account-page">
    <div className="account-heading"><span className="ui-eyebrow">AKUN ANDA</span><h2>Profil Saya</h2><p>Kelola identitas dan foto yang ditampilkan di FotoSnaps.</p></div>
    {guest && <p className="ui-info">Mode Guest Crew. Nama, email kontak, dan foto hanya berlaku selama sesi ini. Data ini tidak membuat akun login baru.</p>}
    {loading && <p role="status">Memuat profil akun…</p>}
    {error && <p className="ui-error" role="alert">{error}</p>}
    {message && <p className="ui-success" role="status">{message}</p>}
    <div className="profile-grid">
      <section className="ui-card profile-photo"><Avatar name={auth?.user.full_name || 'Guest'} src={preview || auth?.user.avatarUrl} large /><h3>Foto profil</h3><p>JPG, PNG, atau WebP. Maksimal 3 MB.</p>
        <label className="ui-button-secondary cursor-pointer">Pilih foto<input aria-label="Pilih foto profil" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!!busy || loading} onChange={e => { const next = e.target.files?.[0]; e.target.value = ''; if (!next) return; if (!['image/jpeg','image/png','image/webp'].includes(next.type) || next.size > 3*1024*1024) { setError('Pilih JPG, PNG, atau WebP, maksimal 3 MB.'); return; } setError(''); setFile(next); }} /></label>
        {file && <><button className="ui-button" disabled={!!busy} onClick={savePhoto}>{busy === 'photo' ? 'Menyimpan…' : 'Simpan foto'}</button><button className="ui-link" disabled={!!busy} onClick={() => setFile(null)}>Batal memilih foto</button></>}
        {auth?.user.avatarUrl && <button className="ui-danger-text" disabled={!!busy || loading} onClick={() => perform('remove', async () => { if (!guest) await api.delete('/users/me/avatar'); updateProfile({ avatarUrl: '' }); setFile(null); return 'Foto profil dihapus.'; })}>Hapus foto profil</button>}
      </section>
      <div className="space-y-5">
        <form className="ui-card space-y-4" onSubmit={saveProfile}><h3>Informasi pribadi</h3>
          <fieldset disabled={!!busy || loading} className="space-y-4"><label className="ui-label">Nama lengkap<input className="ui-input" required minLength={2} maxLength={150} value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
          <label className="ui-label">Nomor WhatsApp / HP<input className="ui-input" type="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" /></label>
          {guest && <label className="ui-label">Email kontak, opsional<input className="ui-input" type="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>}
          <button className="ui-button" type="submit">{busy === 'profile' ? 'Menyimpan…' : 'Simpan profil'}</button></fieldset>
        </form>
        {!guest && <form className="ui-card space-y-4" onSubmit={changeEmail}><h3>Email akun</h3><p>Email aktif: <strong className="break-all">{auth?.user.email}</strong></p>
          {auth?.user.pendingEmail && <p className="ui-info">Menunggu konfirmasi: {auth.user.pendingEmail}. Selesaikan konfirmasi email, lalu masuk ulang.</p>}
          <fieldset disabled={!!busy || loading} className="space-y-4"><label className="ui-label">Email baru<input className="ui-input" required type="email" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          <label className="ui-label">Password saat ini<input className="ui-input" required type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <p>Konfirmasi mengikuti pengaturan keamanan email Supabase. Email aktif tidak diganti hanya dengan menyimpan nama.</p><button className="ui-button-secondary" type="submit" disabled={email.trim().toLowerCase() === auth?.user.email.toLowerCase()}>{busy === 'email' ? 'Mengirim…' : 'Kirim konfirmasi email'}</button></fieldset>
        </form>}
      </div>
    </div>
  </div>;
}
