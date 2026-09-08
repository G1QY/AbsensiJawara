const router = require('express').Router();
const multer = require('multer');
const db = require('../../config/supabaseClient');
const { service } = require('./profile.instance');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });
const handle = fn => async (req, res, next) => { try { res.json(await fn(req)); } catch (error) { next(error); } };
router.use(async (req, res, next) => {
  try {
    const { data, error } = await db.from('users').select('is_active').eq('id', req.user.id).maybeSingle();
    if (error) return res.status(503).json({ message: 'Status akun belum dapat diperiksa.' });
    if (!data?.is_active) return res.status(403).json({ message: 'Akun tidak aktif.' });
    next();
  } catch (error) { next(error); }
});
router.get('/', handle(req => service.get(req.user.id)));
router.patch('/', handle(req => service.update(req.user.id, req.body)));
router.post('/avatar', (req, res, next) => upload.single('photo')(req, res, error => {
  if (error) return res.status(400).json({ message: 'Pilih satu foto JPG, PNG, atau WebP, maksimal 3 MB.' });
  next();
}), handle(req => service.setAvatar(req.user.id, req.file)));
router.delete('/avatar', handle(req => service.removeAvatar(req.user.id)));
router.post('/email', handle(req => service.requestEmail(req.user.id, req.body)));
module.exports = router;
