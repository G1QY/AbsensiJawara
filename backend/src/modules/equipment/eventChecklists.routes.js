const router = require('express').Router();
const multer = require('multer');
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /event-checklists
// body (POST): { eventId, assetId, phase: 'PRE_EVENT'|'POST_EVENT', isPresent, damageNotes, signedBy } + foto (multipart)
const controller = crudFactory('event_checklists', {
  selectQuery: '*, asset:equipment_assets(asset_code, asset_type), event:events(event_name)',
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 30, fieldSize: 10000, parts: 31 } });
const canFill = requireRole(ROLES.SUPER_ADMIN, ROLES.EVENT_MANAGER, ROLES.CREW_EVENT);

router.get('/', controller.list);
router.post('/', canFill, upload.single('photo'), controller.create);
router.patch('/:id', canFill, controller.update);

module.exports = router;
