const router = require('express').Router();
const multer = require('multer');
const controller = require('./attendance.controller');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 30, fieldSize: 10000, parts: 31 } });

// POST /attendance/check-in
router.post('/check-in', upload.single('photo'), controller.checkIn);

// POST /attendance/{id}/check-out
router.post('/:id/check-out', upload.single('photo'), controller.checkOut);

// GET /attendance/today — WAJIB sebelum /:id
router.get('/today', controller.today);

// GET /attendance/calendar?month=YYYY-MM — WAJIB didaftar SEBELUM /:id,
// kalau tidak Express akan menganggap "calendar" sebagai value :id.
router.get('/calendar', controller.calendar);

// GET /attendance
router.get('/', controller.list);

// GET /attendance/{id}
router.get('/:id', controller.getOne);

// PATCH /attendance/{id}
router.patch('/:id', controller.update);

module.exports = router;
