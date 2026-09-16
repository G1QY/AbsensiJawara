const router = require('express').Router();
const controller = require('./dashboard.controller');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

router.get('/revenue', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), async (req, res, next) => {
  try {
    const month = req.query.month || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
    res.json(await require('./revenue.service').loadRevenue(require('../../config/supabaseClient'), month));
  } catch (error) { next(error); }
});

// GET /dashboard/admin
router.get('/admin', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), controller.admin);

// GET /dashboard/crew
router.get('/crew', controller.crew);

module.exports = router;
