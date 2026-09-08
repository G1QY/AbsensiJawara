const router = require('express').Router();
const supabase = require('../../config/supabaseClient');

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications').select('*').eq('user_id', req.user.id)
      .order('created_at', { ascending: false }).limit(50);
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications').update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', req.user.id).select().maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
