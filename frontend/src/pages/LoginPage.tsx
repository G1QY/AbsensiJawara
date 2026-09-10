import { useState, useRef, useEffect } from 'react';
import './LoginPage.css';
import companyLandscape from '../assets/company-landscape.jpg';
import companyPortrait from '../assets/company-portrait.jpg';
import JawaraLogo from '../assets/landscape.jpg';
import { useAuth } from '../lib/AuthContext';
import FloatingInput from '../components/ui/FloatingInput';
import Modal from '../components/ui/Modal';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000') + '/api';
const ADMIN_WHATSAPP_NUMBER = (import.meta.env.VITE_ADMIN_WHATSAPP || '6281214989974').toString().replace(/\D/g, '');
const waHelpMessage = encodeURIComponent('Halo Admin Jawara, saya memerlukan bantuan untuk akses akun / kendala login di sistem Jawara.');
const waAdminUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${waHelpMessage}`;

type PageStep = 'login' | 'forgot' | 'otp-verify' | 'new-password' | 'success';

export default function LoginPage() {
  const { login, loginAsGuest, loading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');

  // Forgot password state
  const [step, setStep] = useState<PageStep>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [devOtp, setDevOtp] = useState(''); // OTP hint untuk dev mode
  const [resetToken, setResetToken] = useState('');
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [animating, setAnimating] = useState(false);

  const handleLogin = async () => {
    setError('');
    let hasErr = false;
    if (!email.trim()) {
      setEmailError('Email is required.');
      hasErr = true;
    }
    if (!password) {
      setPasswordError('Password required.');
      hasErr = true;
    }
    if (hasErr) return;

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : authError || 'Email atau password salah.');
    }
  };

  // Transisi step dengan animasi
  const goToStep = (nextStep: PageStep) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setForgotError('');
      setForgotSuccess('');
      setAnimating(false);
    }, 200);
  };

  // â”€â”€â”€ Forgot Password: Kirim OTP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleForgotSubmit = async () => {
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Masukkan email Anda.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'X-Jawara-Request': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setForgotError(body?.message || 'Gagal mengirim OTP.');
        return;
      }
      // Simpan OTP hint untuk dev mode
      if (body.otp) setDevOtp(body.otp);
      setForgotSuccess(body.message || 'OTP terkirim.');
      goToStep('otp-verify');
    } catch {
      setForgotError('Tidak dapat terhubung ke server.');
    } finally {
      setForgotLoading(false);
    }
  };

  // â”€â”€â”€ OTP Input Handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleOtpChange = (index: number, value: string) => {
    // Hanya terima angka
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    // Auto-focus ke input berikutnya
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      // Focus ke input terakhir yang terisi atau field berikutnya
      const lastIdx = Math.min(pasted.length, 5);
      otpRefs.current[lastIdx]?.focus();
    }
  };

  // Auto-focus first OTP input saat masuk step otp-verify
  useEffect(() => {
    if (step === 'otp-verify') {
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    }
  }, [step]);

  // â”€â”€â”€ Reset Password: Verifikasi OTP + Ganti Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleVerifyOtp = async () => {
    setForgotError('');
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setForgotError('Masukkan kode OTP 6 digit.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'X-Jawara-Request': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), otp }),
      });
      const body = await res.json();
      if (!res.ok) {
        setForgotError(body?.message || 'Kode OTP tidak valid.');
        return;
      }
      setResetToken(body.resetToken);
      goToStep('new-password');
    } catch {
      setForgotError('Tidak dapat terhubung ke server.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    setForgotError('');
    if (!newPassword || newPassword.length < 8) {
      setForgotError('Password baru minimal 8 karakter.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'X-Jawara-Request': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim(), resetToken, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) {
        setForgotError(body?.message || 'Gagal mengubah password.');
        return;
      }
      goToStep('success');
    } catch {
      setForgotError('Tidak dapat terhubung ke server.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Reset semua state forgot dan kembali ke login
  const backToLogin = () => {
    goToStep('login');
    setForgotEmail('');
    setOtpDigits(['', '', '', '', '', '']);
    setNewPassword('');
    setDevOtp('');
    setResetToken('');
    setForgotError('');
    setForgotSuccess('');
  };

  // â”€â”€â”€ Render Error Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderError = (msg: string) => (
    <div className="flex items-center gap-2 p-3 rounded-[4px] bg-[#ffdad6]/40 border border-[#ba1a1a]/30">
      <svg className="w-4 h-4 text-[#ba1a1a] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-[13px] text-[#93000a]">{msg}</p>
    </div>
  );

  // â”€â”€â”€ Render Success Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderSuccess = (msg: string) => (
    <div className="flex items-center gap-2 p-3 rounded-[4px] bg-[#d4edda]/60 border border-[#28a745]/30">
      <svg className="w-4 h-4 text-[#28a745] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-[13px] text-[#155724]">{msg}</p>
    </div>
  );

  // ─── Step: Login Form ──────────────────────────────────────────────────
  const renderLoginForm = () => (
    <>
      {/* Header text */}
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold text-[#1a1c1c] tracking-tight">Selamat Datang Kembali</h1>
        <p className="text-[14px] text-[#4c4451]">Masuk ke akun Jawara Anda untuk melanjutkan</p>
        <p className="text-[14px] text-[#4c4451]">Masuk ke akun Jawara Anda untuk melanjutkan</p>
      </div>

      {/* Login Form */}
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }} noValidate>
        {/* Email */}
        <FloatingInput
          id="email"
          type="email"
          label="Email"
          required
          icon="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError('');
            if (error) setError('');
          }}
          error={emailError}
          autoComplete="email"
        />

        {/* Password */}
        <FloatingInput
          id="password"
          label="Password"
          required
          isPassword
          icon="lock"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError('');
            if (error) setError('');
          }}
          error={passwordError}
          autoComplete="current-password"
        />

        {/* Options row */}
        <div className="flex items-center justify-between pt-1">
          <a
            href={waAdminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-[#4c4451] hover:text-[#25D366] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 group"
            title="Hubungi Admin via WhatsApp untuk bantuan akses akun"
          >
            <span>Hubungi Admin</span>
            <svg className="w-3.5 h-3.5 text-[#25D366] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => goToStep('forgot')}
            className="text-[12px] font-medium text-[#2e0052] hover:text-[#4b0082] uppercase tracking-wider transition-colors"
          >
            Lupa sandi?
          </button>
        </div>

        {error && renderError(error)}

        {/* Submit button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-[#1a1c1c] disabled:opacity-60 text-white text-[13px] font-semibold uppercase tracking-wider rounded-[4px] transition-colors group"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>Log in</span>
                <svg className="w-[16px] h-[16px] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>

      </form>

      <button
        type="button"
        onClick={() => setShowGuestModal(true)}
        className="w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[12px] font-bold uppercase tracking-wider rounded-[4px] transition-colors"
      >
        Masuk sebagai Guest Crew
      </button>

    </>
  );

  // ─── Step: Forgot Password (Email Input) ───
  const renderForgotForm = () => (
    <>
      {/* Back button */}
      <button
        type="button"
        onClick={backToLogin}
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#4c4451] hover:text-[#2e0052] uppercase tracking-wider transition-colors mb-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Login
      </button>

      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold text-[#1a1c1c] tracking-tight">Lupa Sandi?</h1>
        <p className="text-[14px] text-[#4c4451]">
          Masukkan email akun Anda. Kami akan mengirimkan kode OTP untuk mengatur ulang password.
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleForgotSubmit(); }} noValidate>
        <FloatingInput
          id="forgot-email"
          type="email"
          label="Email Akun"
          required
          icon="email"
          value={forgotEmail}
          onChange={(e) => {
            setForgotEmail(e.target.value);
            if (forgotError) setForgotError('');
          }}
          autoFocus
          autoComplete="email"
        />

        {forgotError && renderError(forgotError)}

        <div className="pt-3">
          <button
            type="submit"
            disabled={forgotLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2e0052] hover:bg-[#4b0082] disabled:opacity-60 text-white text-[13px] font-semibold uppercase tracking-wider rounded-[4px] transition-colors group"
          >
            {forgotLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Mengirim OTP...</span>
              </>
            ) : (
              <>
                <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Kirim Kode OTP</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-2 text-center">
          <p className="text-[12px] text-[#7d7483]">
            Perlu bantuan akses akun?{' '}
            <a
              href={waAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2e0052] font-semibold hover:underline inline-flex items-center gap-1"
            >
              Hubungi Admin WhatsApp
            </a>
          </p>
        </div>
      </form>
    </>
  );

  // ─── Step: OTP Verification ───────────────────────────────────────────
  const renderOtpForm = () => (
    <>
      {/* Back button */}
      <button
        type="button"
        onClick={() => goToStep('forgot')}
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#4c4451] hover:text-[#2e0052] uppercase tracking-wider transition-colors mb-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Kembali
      </button>

      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold text-[#1a1c1c] tracking-tight">Verifikasi OTP</h1>
        <p className="text-[14px] text-[#4c4451]">
          Masukkan kode 6 digit yang dikirim ke <span className="font-semibold text-[#1a1c1c]">{forgotEmail}</span>
        </p>
      </div>

      {/* Dev mode OTP hint */}
      {devOtp && (
        <div className="flex items-center gap-2 p-3 rounded-[4px] bg-[#eef2ff] border border-[#6366f1]/30">
          <svg className="w-4 h-4 text-[#6366f1] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[13px] text-[#4338ca]">
            <span className="font-medium">Dev Mode —</span> Kode OTP Anda: <span className="font-mono font-bold tracking-widest">{devOtp}</span>
          </p>
        </div>
      )}

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleVerifyOtp(); }} noValidate>
        {/* OTP Inputs */}
        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-[#4c4451] uppercase tracking-wider">
            Kode OTP
          </label>
          <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className="w-12 h-14 text-center text-[20px] font-semibold font-mono bg-white border-2 border-[#e2e8f0] focus:border-[#2e0052] focus:ring-1 focus:ring-[#2e0052] rounded-[6px] text-[#1a1c1c] outline-none transition-all"
                style={{ caretColor: '#2e0052' }}
              />
            ))}
          </div>
        </div>

        {forgotError && renderError(forgotError)}

        <div className="pt-3">
          <button
            type="submit"
            disabled={forgotLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2e0052] hover:bg-[#4b0082] disabled:opacity-60 text-white text-[13px] font-semibold uppercase tracking-wider rounded-[4px] transition-colors group"
          >
            {forgotLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Verifikasi OTP</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Kirim ulang OTP */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => { setOtpDigits(['', '', '', '', '', '']); handleForgotSubmit(); }}
          disabled={forgotLoading}
          className="text-[12px] font-medium text-[#2e0052] hover:text-[#4b0082] uppercase tracking-wider transition-colors disabled:opacity-50"
        >
          Kirim Ulang OTP
        </button>
      </div>
    </>
  );

  const renderNewPasswordForm = () => (
    <>
      <button
        type="button"
        onClick={() => goToStep('otp-verify')}
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#4c4451] hover:text-[#2e0052] uppercase tracking-wider transition-colors mb-2"
      >
        Kembali
      </button>
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold text-[#1a1c1c] tracking-tight">Buat Password Baru</h1>
        <p className="text-[14px] text-[#4c4451]">OTP sudah terverifikasi. Masukkan password baru minimal 8 karakter.</p>
      </div>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleResetSubmit(); }} noValidate>
        <FloatingInput
          id="new-password"
          label="Password Baru"
          required
          isPassword
          icon="lock"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (forgotError) setForgotError('');
          }}
          autoComplete="new-password"
        />
        {forgotError && renderError(forgotError)}
        <button
          type="submit"
          disabled={forgotLoading}
          className="w-full flex items-center justify-center px-4 py-3 bg-[#2e0052] hover:bg-[#4b0082] disabled:opacity-60 text-white text-[13px] font-semibold uppercase tracking-wider rounded-[4px] transition-colors"
        >
          {forgotLoading ? 'Mengubah Password...' : 'Simpan Password Baru'}
        </button>
      </form>

    </>
  );

  // â”€â”€â”€ Step: Success â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderSuccess2 = () => (
    <div className="text-center space-y-6 py-6">
      {/* Success icon */}
      <div className="mx-auto w-16 h-16 rounded-full bg-[#d4edda] flex items-center justify-center">
        <svg className="w-8 h-8 text-[#28a745]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-[24px] font-semibold text-[#1a1c1c] tracking-tight">Password Berhasil Diubah!</h1>
        <p className="text-[14px] text-[#4c4451]">
          Password Anda telah diperbarui. Silakan login menggunakan password baru.
        </p>
      </div>

      <div className="pt-3">
        <button
          type="button"
          onClick={backToLogin}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-[#1a1c1c] text-white text-[13px] font-semibold uppercase tracking-wider rounded-[4px] transition-colors group"
        >
          <span>Kembali ke Login</span>
          <svg className="w-[16px] h-[16px] group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      </div>
    </div>
  );

  // â”€â”€â”€ Step Router â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStepContent = () => {
    switch (step) {
      case 'login': return renderLoginForm();
      case 'forgot': return renderForgotForm();
      case 'otp-verify': return renderOtpForm();
      case 'new-password': return renderNewPasswordForm();
      case 'success': return renderSuccess2();
    }
  };

  return (
    <div className="login-page min-h-screen flex flex-col md:flex-row bg-[#f9f9f9] text-[#1a1c1c]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <img src={companyPortrait} alt="" aria-hidden="true" className="login-mobile-background" />
      {/* Form Section (Left) */}
      <div className="login-form-section w-full md:w-1/2 flex flex-col justify-center items-center p-6 md:p-10 relative z-10">
        <div className="login-panel w-full max-w-sm space-y-8">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-[4px] overflow-hidden flex-shrink-0 ring-1 ring-[#e2e8f0]">
              <img src={JawaraLogo} alt="Jawara" className="h-full w-full object-cover" />
            </div>
            <span className="text-[22px] font-semibold tracking-tighter uppercase text-[#1a1c1c]">Jawara</span>
          </div>

          {/* Step content with animation */}
          <div
            className="space-y-5"
            style={{
              opacity: animating ? 0 : 1,
              transform: animating ? 'translateY(12px)' : 'translateY(0)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
            }}
          >
            {renderStepContent()}
          </div>

          <p className="text-[11px] text-[#7d7483] text-center">&copy; 2026 Jawara. All rights reserved.</p>
          <p className="text-[11px] text-[#7d7483] text-center">&copy; 2026 Jawara. All rights reserved.</p>
        </div>
      </div>

      <div className="login-company-visual hidden md:flex md:w-1/2">
        <img src={companyLandscape} alt="Jawara, Burger Chill, dan Kripik Bujangan" className="login-company-image" />
      </div>

      <Modal open={showGuestModal} onClose={() => setShowGuestModal(false)} title="Masuk sebagai Guest Crew">
        <div className="space-y-4">
          <FloatingInput
            id="guest-name"
            label="Nama Lengkap"
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            autoComplete="name"
          />
          <FloatingInput
            id="guest-phone"
            type="tel"
            label="Nomor WhatsApp"
            required
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            autoComplete="tel"
          />
          <button
            type="button"
            disabled={!guestName.trim() || !guestPhone.trim()}
            onClick={() => {
              loginAsGuest({ name: guestName, phone: guestPhone });
              setShowGuestModal(false);
            }}
            className="w-full px-4 py-3 rounded-[4px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[12px] font-bold uppercase tracking-wider"
          >
            Lanjut ke Mode Guest
          </button>
        </div>
      </Modal>

    </div>
  );
}

