const router = require('express').Router();
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /store-assignments
// Sekarang tanpa filter tenant — isolasi cukup lewat RLS di database.
const controller = crudFactory('store_assignments', {
  selectQuery: '*, crew:crew(id, employee_code, user:users(full_name)), store:stores(name)',
});
const canManage = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE);

router.get('/', controller.list);
router.post('/', canManage, controller.create);
router.patch('/:id', canManage, controller.update);

module.exports = router;
