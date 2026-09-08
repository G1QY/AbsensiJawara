const router = require('express').Router();
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const controller = require('./crew.controller');

const canManage = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER);

// GET /crew
router.get('/', canManage, controller.list);
router.get('/:id', canManage, controller.detail);
router.delete('/:id', canManage, controller.archive);

// POST /crew — buat akun crew baru (auth.users + user_roles + crew sekaligus)
router.post('/', canManage, controller.create);

// PATCH /crew/:id — update profil/status/gaji
router.patch('/:id', canManage, controller.update);

// PATCH /crew/:id/reset-password
router.patch('/:id/reset-password', canManage, controller.resetPassword);
router.patch('/:id/email', canManage, controller.updateEmail);

module.exports = router;
