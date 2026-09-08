-- Migration: Create password_reset_otps table
-- Digunakan untuk menyimpan OTP (hashed) untuk fitur forgot password.

CREATE TABLE IF NOT EXISTS password_reset_otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk lookup cepat berdasarkan email + status
CREATE INDEX idx_password_reset_otps_email_used
  ON password_reset_otps (email, used)
  WHERE used = FALSE;

-- Otomatis hapus OTP yang sudah expired setelah 1 hari (opsional, bisa dijadwalkan via cron)
COMMENT ON TABLE password_reset_otps IS 'Menyimpan OTP (hashed) untuk fitur forgot/reset password. OTP berlaku 5 menit.';
