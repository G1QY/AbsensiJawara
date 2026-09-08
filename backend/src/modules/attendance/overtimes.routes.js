const router = require('express').Router();
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /overtimes
const controller = crudFactory('overtimes', {
  selectQuery: '*, crew:crew(employee_code, user:users(full_name))',
});
const canApprove = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER);

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id', canApprove, controller.update);

module.exports = router;
