// Login sekarang lewat Supabase Auth (bukan bcrypt manual) — password
// dikelola sepenuhnya oleh auth.users, backend cuma proxy ke sana lalu
// lengkapi responsnya dengan profil + role dari database kita.

const crypto = require('crypto');
const supabase = require('../../config/supabaseClient');
const { service: profileService, sessionClient } = require('../profile/profile.instance');
const { sendOtpEmail, emailConfig } = require('../../utils/otpEmail');

// ─── Helper: hash OTP dengan SHA-256 ────────────────────────────────
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

// POST /auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 1024 || !email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const { data, error: authError } = await sessionClient().auth.signInWithPassword({ email: cleanEmail, password });
    if (authError || !data?.session || !data?.user) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }
    const authSession = data.session;
    const authUser = data.user;

    // Jika Supabase Auth berhasil:
    const [{ data: profile, error: profileError }, { data: userRole, error: roleError }] = await Promise.all([
      supabase.from('users').select('id, full_name, email, phone_number, is_active').eq('id', authUser.id).maybeSingle(),
      supabase.from('user_roles').select('role:roles(code, name)').eq('user_id', authUser.id).maybeSingle(),
    ]);

    if (profileError || !profile || !profile.is_active) {
      return res.status(403).json({ message: 'Profil pengguna belum terdaftar. Hubungi admin.' });
    }
    if (roleError || !userRole?.role?.code) {
      return res.status(403).json({ message: 'Role pengguna belum ditetapkan. Hubungi admin.' });
    }

    const roleCode = userRole.role.code;

    res.json({
      token: authSession.access_token,
      refreshToken: authSession.refresh_token,
      user: await profileService.get(authUser.id, authUser),
      role: roleCode,
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/logout
async function logout(req, res, next) {
  try {
    // Revoke refresh token di sisi Supabase Auth (opsional tapi disarankan)
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) await supabase.auth.admin.signOut(token).catch(() => {});
    res.json({ message: 'Berhasil logout.' });
  } catch (err) {
    next(err);
  }
}

// GET /auth/me
async function me(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !profile) return res.status(404).json({ message: 'Profil tidak ditemukan.' });

    res.json({ ...profile, role: req.role });
  } catch (err) {
    next(err);
  }
}

// ─── POST /auth/forgot-password ─────────────────────────────────────
// Generate OTP 6 digit, hash & simpan ke tabel password_reset_otps.
// Di dev mode OTP dikembalikan langsung di response (production: kirim via email).
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email wajib diisi.' });
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({message:'Email tidak valid.'});
    emailConfig();
    // Cek apakah email terdaftar di tabel users
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ message: 'Email tidak terdaftar di sistem.' });
    }

    const { data: recentOtp } = await supabase
      .from('password_reset_otps')
      .select('created_at')
      .eq('email', user.email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentOtp && Date.now() - new Date(recentOtp.created_at).getTime() < 60_000) {
      return res.status(429).json({ message: 'Tunggu 60 detik sebelum meminta OTP baru.' });
    }

    // Invalidasi OTP lama yang belum dipakai untuk email ini
    await supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', email.toLowerCase().trim())
      .eq('used', false);

    // Generate OTP 6 digit (100000–999999)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 menit

    // Simpan ke database
    const { error: insertError } = await supabase
      .from('password_reset_otps')
      .insert({ email: email.toLowerCase().trim(), otp_hash: otpHash, expires_at: expiresAt });

    if (insertError) {
      console.error('[forgotPassword] insert error:', insertError);
      return res.status(500).json({ message: 'Gagal membuat OTP. Coba lagi.' });
    }

    try {
      await sendOtpEmail(user.email, otp);
    } catch (emailError) {
      await supabase.from('password_reset_otps').update({ used: true }).eq('email', user.email).eq('otp_hash', otpHash);
      throw emailError;
    }

    const response = { message: 'Kode OTP telah dikirim ke email Anda.' };
    if (process.env.ENABLE_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production') {
      response.otp = otp;
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

// POST /auth/verify-otp
async function verifyOtp(req, res, next) {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const otp = String(req.body.otp || '');
    if (!email || !/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Email dan kode OTP 6 digit wajib diisi.' });

    const { data: otpRecord, error } = await supabase
      .from('password_reset_otps')
      .select('id, otp_hash, expires_at, attempts')
      .eq('email', email)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !otpRecord) return res.status(400).json({ message: 'Kode OTP salah atau sudah digunakan.' });
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);
      return res.status(400).json({ message: 'Kode OTP sudah kedaluwarsa. Silakan minta OTP baru.' });
    }
    if (otpRecord.attempts >= 5) {
      await supabase.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);
      return res.status(429).json({ message: 'Terlalu banyak percobaan. Minta OTP baru.' });
    }

    const suppliedHash = Buffer.from(hashOtp(otp), 'hex');
    const storedHash = Buffer.from(otpRecord.otp_hash, 'hex');
    if (suppliedHash.length !== storedHash.length || !crypto.timingSafeEqual(suppliedHash, storedHash)) {
      await supabase.from('password_reset_otps').update({ attempts: otpRecord.attempts + 1 }).eq('id', otpRecord.id);
      return res.status(400).json({ message: 'Kode OTP salah.' });
    }

    const resetToken = crypto.randomBytes(32).toString('base64url');
    const resetTokenHash = hashOtp(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: updateError } = await supabase.from('password_reset_otps').update({
      verified_at: new Date().toISOString(),
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: resetTokenExpiresAt,
    }).eq('id', otpRecord.id);
    if (updateError) throw Object.assign(new Error(updateError.message), { status: 500 });

    res.json({ message: 'OTP berhasil diverifikasi.', resetToken });
  } catch (err) {
    next(err);
  }
}

// POST /auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) return res.status(400).json({ message: 'Data reset password tidak lengkap.' });
    if (newPassword.length < 8) return res.status(400).json({ message: 'Password baru minimal 8 karakter.' });

    const { data: otpRecord } = await supabase
      .from('password_reset_otps')
      .select('id, reset_token_expires_at')
      .eq('email', email)
      .eq('reset_token_hash', hashOtp(resetToken))
      .eq('used', false)
      .not('verified_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord || new Date(otpRecord.reset_token_expires_at) < new Date()) {
      return res.status(400).json({ message: 'Sesi reset password tidak valid atau kedaluwarsa.' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[resetPassword] update error:', updateError);
      return res.status(500).json({ message: 'Gagal mengubah password. Coba lagi.' });
    }

    await supabase.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id);

    res.json({ message: 'Password berhasil diubah. Silakan login dengan password baru Anda.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, forgotPassword, verifyOtp, resetPassword };
