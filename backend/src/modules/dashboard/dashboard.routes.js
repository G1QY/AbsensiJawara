const router = require('express').Router();
const controller = require('./dashboard.controller');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET /dashboard/admin
router.get('/admin', requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), controller.admin);

// GET /dashboard/crew
router.get('/crew', controller.crew);

module.exports = router;
