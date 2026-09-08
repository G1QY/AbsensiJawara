require('dotenv').config({path:require('path').resolve(__dirname,'../.env')});
const {emailConfig}=require('../src/utils/otpEmail');
try {
 const {from}=emailConfig();
 console.log('RESEND_API_KEY tersedia (nilainya tidak ditampilkan).');
 console.log('OTP_EMAIL_FROM:',from);
 if(/@resend\.dev\b/i.test(from))console.log('MODE UJI: hanya email pemilik akun Resend yang dapat menerima. Untuk crew lain, verifikasi domain di Resend lalu gunakan alamat pengirim domain tersebut.');
 else console.log('Pastikan domain pengirim ini berstatus Verified pada Resend dan API key memiliki izin pengiriman.');
 console.log('Pemeriksaan ini tidak mengirim email dan tidak membuktikan key/domain sudah diterima Resend. Uji melalui Lupa Sandi lalu lihat status di Resend Emails.');
}catch(e){console.error(e.message);process.exitCode=1;}
