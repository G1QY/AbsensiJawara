const router = require('express').Router();
const authenticate = require('../../middlewares/authenticate');
const attachRole = require('../../middlewares/attachRole');
const controller = require('./auth.controller');

// Route publik — tidak butuh token
router.post('/login', controller.login);
router.post('/forgot-password', controller.forgotPassword);
router.post('/verify-otp', controller.verifyOtp);
router.post('/reset-password', controller.resetPassword);

// Route yang butuh token
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, attachRole, controller.me);

module.exports = router;
