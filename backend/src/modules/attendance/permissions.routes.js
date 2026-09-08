const router = require('express').Router();
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /permissions (izin/cuti crew)
const controller = crudFactory('permissions', {
  selectQuery: '*, crew:crew(employee_code, user:users(full_name))',
});
const canApprove = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER);

router.get('/', controller.list);
router.post('/', controller.create); // crew mengajukan izin sendiri
router.patch('/:id', canApprove, controller.update); // approval hanya admin/manager

module.exports = router;
