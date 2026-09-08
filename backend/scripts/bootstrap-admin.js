// Membuat akun admin PERTAMA di sistem lewat Supabase Auth Admin API
// (bukan lewat SQL, karena password dikelola Supabase Auth).
//
// Jalankan SEKALI setelah `supabase db reset`, dari dalam folder backend:
//   cd backend
//   node scripts/bootstrap-admin.js
//
// Butuh backend/.env terisi SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
// (key "Secret" dari `supabase status`).

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('=== Bootstrap Akun Admin Pertama — FotoSnaps ===\n');

  const email = (await ask('Email admin (mis. admin@fotosnaps.id): ')).trim();
  const fullName = (await ask('Nama lengkap: ')).trim() || 'Admin Utama';
  const password = (await ask('Password (min. 8 karakter): ')).trim();

  if (!email || password.length < 8) {
    console.error('\nEmail wajib diisi dan password minimal 8 karakter. Batal.');
    process.exit(1);
  }

  // 1) Buat akun di Supabase Auth. Trigger on_auth_user_created (lihat
  //    001_foundation.sql) otomatis bikinkan baris di public.users.
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // langsung terverifikasi, tidak perlu klik link email
    user_metadata: { full_name: fullName },
  });

  if (authErr) {
    console.error('\nGagal membuat akun Auth:', authErr.message);
    process.exit(1);
  }

  const userId = authUser.user.id;
  console.log(`\nAkun Auth berhasil dibuat (id: ${userId}).`);

  // 2) Kaitkan ke role SUPER_ADMIN
  const { data: role, error: roleErr } = await supabase
    .from('roles')
    .select('id')
    .eq('code', 'SUPER_ADMIN')
    .single();

  if (roleErr || !role) {
    console.error('\nRole SUPER_ADMIN tidak ditemukan — pastikan supabase/seed.sql sudah dijalankan.');
    process.exit(1);
  }

  const { error: urErr } = await supabase.from('user_roles').insert({ user_id: userId, role_id: role.id });
  if (urErr) {
    console.error('\nGagal mengaitkan role:', urErr.message);
    process.exit(1);
  }

  console.log(`\n✅ Selesai! Admin "${fullName}" (${email}) siap dipakai login dengan role SUPER_ADMIN.`);
  process.exit(0);
}

main();
