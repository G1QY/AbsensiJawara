const router = require('express').Router();
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const controller = require('./inspectionReports.controller');

// POST /inspection-reports/{event_id}/generate
router.post('/:eventId/generate', requireRole(ROLES.SUPER_ADMIN, ROLES.EVENT_MANAGER), controller.generate);

module.exports = router;
