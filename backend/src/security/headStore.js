// Head Store has a dedicated city-scoped API. Never fall through to global admin routes.
function headStoreBoundary(req, res, next) {
  if (!['HEAD_STORE', 'ADMIN_STORE'].includes(req.role)) return next();
  const path = req.path.toLowerCase();
  if (path === '/head-store' || path.startsWith('/head-store/') ||
      path === '/users/me' || path.startsWith('/users/me/') ||
      path === '/notifications' || path.startsWith('/notifications/')) return next();
  return res.status(403).json({ message: 'Head Store hanya dapat mengakses monitoring kota yang ditugaskan.' });
}
module.exports = { headStoreBoundary };
