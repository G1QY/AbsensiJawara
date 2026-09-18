const express = require('express');
const requireRole = require('../../middlewares/requireRole');
const { ROLES } = require('../../config/constants');
const { service } = require('./geocoding.service');
const { createLocationLimits } = require('../../security/http');
const locationLimits = createLocationLimits();
function handler(kind) {
  return async (req, res, next) => {
    try {
      const results = kind === 'search' ? await service().search(req.body?.text) : await service().reverse(req.body?.latitude, req.body?.longitude);
      res.json({ results });
    } catch (error) { if (error.status === 429) res.setHeader('Retry-After', '30'); next(error); }
  };
}
const admin = express.Router();
admin.use(requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER), locationLimits);
admin.post('/search', handler('search'));
admin.post('/reverse', handler('reverse'));
// Guest can resolve a GPS point, never search the directory or read attendance.
const guest = express.Router();
guest.post('/reverse', locationLimits, handler('reverse'));
module.exports = { admin, guest };
