// Konstanta bisnis sesuai PRD — jangan hardcode angka ini di tempat lain.

module.exports = {
  ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN_STORE: 'ADMIN_STORE',
    CREW_STORE: 'CREW_STORE',
    EVENT_MANAGER: 'EVENT_MANAGER',
    CREW_EVENT: 'CREW_EVENT',
  },

  // Section 4 & 7 — Attendance Anti-Fraud
  DEFAULT_GEOFENCE_RADIUS_METERS: 50,
  MAX_SELFIE_WIDTH_PX: 800,
  SELFIE_JPEG_QUALITY: 80,

  // Section 5 — Stock Opname
  STOCK_DISCREPANCY_APPROVAL_THRESHOLD_PERCENT: 2,

  // Section 6 — Auto-PDF Inspection Report
  INSPECTION_REPORT_TARGET_MS: 3000,
};
