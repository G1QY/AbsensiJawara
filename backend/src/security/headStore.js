// Restricted workspaces only reach their own server-validated attendance/profile APIs.
function headStoreBoundary(req, res, next) {
  const cityRole = ['HEAD_STORE', 'ADMIN_STORE'].includes(req.role);
  const staffRole = ['HEAD_OFFICE', 'OFFICE_STAFF', 'PRODUCTION_STAFF'].includes(req.role);
  if (!cityRole && !staffRole) return next();
  const path = req.path.toLowerCase();
  const own = ['/users/me', '/notifications', '/attendance', '/crew-store/workspace', '/payroll/me'];
  if (own.some(base => path === base || path.startsWith(base + '/')) ||
      (cityRole && (path === '/head-store' || path.startsWith('/head-store/')))) return next();
  return res.status(403).json({ message: cityRole ? 'Head Store hanya dapat mengakses kota yang ditugaskan dan absensi pribadi.' : 'Akses dibatasi pada profil dan absensi pribadi.' });
}
module.exports = { headStoreBoundary };
