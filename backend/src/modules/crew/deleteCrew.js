const db = require('../../config/supabaseClient');
const { uuid, fail } = require('./crew.validation');
async function deleteCrew(req, res, next) {
  let prepared;
  try {
    uuid(req.params.id);
    if (req.body?.confirm !== true || typeof req.body?.email !== 'string')
      throw fail('Konfirmasi hapus permanen dan email akun diperlukan.');
    const { data, error } = await db.rpc('prepare_crew_deletion', {
      p_actor: req.user.id, p_crew: req.params.id, p_email: req.body.email.trim().toLowerCase(),
    });
    if (error) throw fail(error.message, error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 409);
    prepared = data;
    const result = await db.auth.admin.deleteUser(data.user_id, false);
    if (result.error) throw result.error;
    // Auth deletion cascades transactionally into public.users, crew and their dependencies.
    res.json({ message: 'Crew dan akun login dihapus permanen. Email dapat digunakan kembali.' });
  } catch (error) {
    if (prepared) {
      // Do not claim success or reactivate a possibly deleted account on an ambiguous network error.
      // A failed deletion remains disabled and can be retried from the account list.
      error = fail('Penghapusan Auth belum terkonfirmasi. Akun dinonaktifkan. Coba Hapus permanen lagi; jangan hapus tabel secara manual.', 503);
    }
    next(error);
  }
}
module.exports = { deleteCrew };
