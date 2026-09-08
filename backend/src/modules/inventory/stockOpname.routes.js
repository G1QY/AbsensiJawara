const router = require('express').Router();
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const controller = require('./stockOpname.controller');

const canApprove = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE);

router.get('/', controller.list);
router.post('/', controller.create); // Crew Store input hasil opname
router.patch('/:id', canApprove, controller.update); // Admin approve/reject bila >2%

module.exports = router;
