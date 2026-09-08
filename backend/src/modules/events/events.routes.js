const router = require('express').Router();
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /events
const controller = crudFactory('events');
const canManage = requireRole(ROLES.SUPER_ADMIN, ROLES.EVENT_MANAGER);

router.get('/', controller.list);
router.post('/', canManage, controller.create);
router.patch('/:id', canManage, controller.update);

module.exports = router;
