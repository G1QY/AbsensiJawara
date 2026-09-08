const router = require('express').Router();
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const controller = require('./inventoryStocks.controller');

const canManage = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.CREW_STORE);

router.get('/', controller.list);
router.post('/', canManage, controller.create);
router.patch('/:id', canManage, controller.update);

module.exports = router;
