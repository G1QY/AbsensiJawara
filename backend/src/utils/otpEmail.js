function emailConfig(env = process.env) {
  const apiKey = (env.RESEND_API_KEY || '').trim();
  const from = (env.OTP_EMAIL_FROM || '').trim();
  if (!apiKey || !from) throw Object.assign(new Error('Email OTP belum siap. Admin perlu mengisi RESEND_API_KEY dan OTP_EMAIL_FROM pada backend.'), {status:503});
  if (!/^re_\S+$/.test(apiKey) || !/^[^\r\n]+@[^\r\n]+$/.test(from)) throw Object.assign(new Error('Format konfigurasi pengirim OTP tidak valid. Hubungi admin.'), {status:503});
  return {apiKey,from};
}
function deliveryError(status, body = {}) {
  const detail = String(body.message || '').toLowerCase();
  let message = 'Layanan email sedang gagal. Coba lagi atau hubungi admin.';
  if (detail.includes('testing emails') || detail.includes('own email')) message = 'Pengirim Resend masih mode uji. Email crew belum dapat menerima OTP. Admin perlu memakai domain pengirim terverifikasi.';
  else if (detail.includes('domain') || detail.includes('not verified')) message = 'Domain pengirim OTP belum terverifikasi atau tidak sesuai. Admin perlu memperbaiki OTP_EMAIL_FROM di backend.';
  else if (status === 401 || status === 403) message = 'Kunci atau izin layanan email ditolak. Admin perlu memeriksa RESEND_API_KEY dan izin pengiriman.';
  else if (status === 429) message = 'Batas pengiriman email tercapai. Tunggu sebentar atau hubungi admin untuk memeriksa kuota Resend.';
  return Object.assign(new Error(message), {status:503, code:'OTP_DELIVERY_FAILED'});
}
async function sendOtpEmail(email, otp) {
  const {apiKey,from} = emailConfig();
  let response;
  try {response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Kode OTP Reset Password FotoSnaps',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>Reset Password FotoSnaps</h2><p>Gunakan kode berikut untuk melanjutkan reset password:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>Kode berlaku selama 5 menit. Abaikan email ini jika Anda tidak meminta reset password.</p></div>`,
    }),
  });} catch {throw Object.assign(new Error('Backend tidak dapat menghubungi layanan email. Periksa koneksi internet server lalu coba lagi.'),{status:503});}

  const detail = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[otpEmail] delivery rejected:', response.status, detail.name || 'provider_error');
    throw deliveryError(response.status, detail);
  }
  if (!detail.id) throw deliveryError(502);
  return {id:detail.id};
}

module.exports = { sendOtpEmail, emailConfig, deliveryError };
