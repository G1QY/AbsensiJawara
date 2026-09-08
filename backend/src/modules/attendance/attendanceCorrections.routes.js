const router = require('express').Router();
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const controller = require('./attendanceCorrections.controller');

const canApprove = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER);

router.get('/', requireRole(ROLES.SUPER_ADMIN), controller.list);
router.post('/', (req,res)=>res.status(405).json({message:'Gunakan alur review absensi admin yang tervalidasi.'}));
router.patch('/:id', (req,res)=>res.status(405).json({message:'Gunakan alur review absensi admin yang tervalidasi.'}));

module.exports = router;
