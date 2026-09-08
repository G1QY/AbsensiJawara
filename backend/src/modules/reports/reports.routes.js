const router = require('express').Router();
const controller = require('./reports.controller');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
router.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER));

router.get('/attendance', controller.attendance);
router.get('/events', controller.events);
// NOTE: /reports/inventory dipindah — inventory sekarang milik database
// Bujangan Food (lihat REPORT_PROGRESS Section 7), tidak ada di sini lagi.

module.exports = router;
