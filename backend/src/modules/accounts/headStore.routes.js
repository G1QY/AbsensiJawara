const router = require('express').Router();
const db = require('../../config/supabaseClient');
const requireRole = require('../../middlewares/requireRole');
const { wibDate } = require('../../utils/attendanceTime');
router.use(requireRole('HEAD_STORE', 'ADMIN_STORE'));
router.get('/', async (req, res, next) => {
  try {
    const today = wibDate(new Date());
    const from = req.query.from || today, to = req.query.to || today;
    const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    if (!valid(from) || !valid(to) || from > to || (Date.parse(to)-Date.parse(from))/86400000 > 92)
      return res.status(400).json({ message: 'Pilih rentang tanggal valid, maksimal 93 hari.' });
    // Actor and city are resolved server-side, never taken from request parameters.
    const { data, error } = await db.rpc('head_store_workspace', { p_actor: req.user.id, p_from: from, p_to: to });
    if (error) throw Object.assign(new Error(error.message), { status: error.code === '42501' ? 403 : 400 });
    res.json(data);
  } catch (error) { next(error); }
});
module.exports = router;
