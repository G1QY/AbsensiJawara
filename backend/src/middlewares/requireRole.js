// Guard sederhana berbasis role (RBAC). Pakai setelah `authenticate` + `attachRole`
// supaya req.role sudah tersedia. Contoh: router.post('/stores', requireRole('SUPER_ADMIN', 'ADMIN_STORE'), ...)

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
      return res.status(403).json({ message: 'Role Anda tidak memiliki izin untuk aksi ini.' });
    }
    next();
  };
}

module.exports = requireRole;
