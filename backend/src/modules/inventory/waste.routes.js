const router = require('express').Router();
const multer = require('multer');
const crudFactory = require('../../utils/crudFactory');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');

// GET/POST/PATCH /waste
// body (POST): { storeId, itemId, wasteQty, reasonCategory } + foto evidence (multipart)
const controller = crudFactory('waste_logs', {
  selectQuery: '*, item:inventory_items(item_code, name, unit), store:stores(name)',
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 30, fieldSize: 10000, parts: 31 } });
const canManage = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.CREW_STORE);

router.get('/', controller.list);
router.post('/', canManage, upload.single('photo'), controller.create);
router.patch('/:id', canManage, controller.update);

module.exports = router;
