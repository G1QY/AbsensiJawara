const express = require('express');
const morgan = require('morgan');

const authenticate = require('./middlewares/authenticate');
const attachRole = require('./middlewares/attachRole');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

const {installSecurity,userLimits,uploadLimits}=require('./security/http');
installSecurity(app);
app.use(morgan(':method :url :status :response-time ms', {stream:{write:line=>console.log(line.replace(/\?.*?(?= \d{3} )/g,'').trim())}}));

// /health SENGAJA di luar prefix /api (dipakai load balancer/uptime check)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'fotosnaps-backend' }));

// ---------------------------------------------------------------------
// Semua endpoint bisnis dipasang di bawah prefix /api, sesuai daftar
// endpoint final di REPORT_PROGRESS 25 Agustus 2026 Section 16
// (mis. POST /api/attendance/check-in).
// ---------------------------------------------------------------------
const api = express.Router();

// Auth — publik untuk /login, butuh token untuk /logout & /me
api.use('/auth', require('./modules/auth/auth.routes'));
api.use('/guest-attendance', require('./modules/attendance/guestAttendance.routes').router);

// Semua route di bawah ini WAJIB login (authenticate) + attachRole
// (menempelkan req.role dari user_roles, dipakai requireRole per-route).
//
// TIDAK ADA lagi tenantContext / X-Tenant-Id — database ini sudah
// khusus FotoSnaps, isolasi data cukup lewat RLS (auth.uid()) di
// database, bukan filter tenant_id manual di backend.
api.use(authenticate, attachRole, userLimits, uploadLimits);
api.use((req,res,next)=>{res.on('finish',()=>{if(!['GET','HEAD','OPTIONS'].includes(req.method))console.log(JSON.stringify({event:'authenticated_mutation',requestId:req.requestId,userId:req.user.id,role:req.role,method:req.method,route:req.route?.path,status:res.statusCode}));});next();});

api.use('/users', require('./modules/users/users.routes'));
api.use('/crew', require('./modules/crew/crew.routes'));
api.use('/admin-directory', require('./modules/crew/directory.routes'));

api.use('/stores', require('./modules/stores/stores.routes'));
api.use('/store-assignments', require('./modules/stores/storeAssignments.routes'));
api.use('/store-schedules', require('./modules/stores/storeSchedules.routes'));
api.use('/admin-store-schedules', require('./modules/stores/adminStoreSchedules.routes'));
api.use('/crew-store/workspace', require('./modules/stores/crewStoreWorkspace.routes'));

api.use('/events', require('./modules/events/events.routes'));
api.use('/admin-events', require('./modules/events/adminEvents.routes'));
api.use('/event-workflows', require('./modules/events/eventWorkflows.routes'));
api.use('/crew-event', require('./modules/events/crewEventWorkspace.routes'));
api.use('/event-locations', require('./modules/events/eventLocations.routes'));
api.use('/event-assignments', require('./modules/events/eventAssignments.routes'));
api.use('/event-schedules', require('./modules/events/eventSchedules.routes'));

api.use('/attendance', require('./modules/attendance/attendance.routes'));
api.use('/admin-attendance', require('./modules/attendance/adminAttendance.routes'));
api.use('/permissions', require('./modules/attendance/permissions.routes'));
api.use('/attendance-corrections', require('./modules/attendance/attendanceCorrections.routes'));
api.use('/overtimes', require('./modules/attendance/overtimes.routes'));

api.use('/equipment-assets', require('./modules/equipment/equipmentAssets.routes'));
api.use('/event-asset-assignments', require('./modules/equipment/eventAssetAssignments.routes'));
api.use('/event-checklists', require('./modules/equipment/eventChecklists.routes'));
api.use('/inspection-reports', require('./modules/equipment/inspectionReports.routes'));

api.use('/dashboard', require('./modules/dashboard/dashboard.routes'));
api.use('/reports', require('./modules/reports/reports.routes'));
api.use('/audit-logs', require('./modules/auditLogs/auditLogs.routes'));
api.use('/notifications', require('./modules/notifications/notifications.routes'));

// NOTE: /inventory-items, /inventory-stocks, /stock-opname, /waste SENGAJA
// TIDAK dipasang di sini — inventory sekarang milik database Bujangan Food
// yang terpisah (lihat REPORT_PROGRESS Section 6 & 20: "Jangan mengerjakan
// inventory Bujangan Food dulu"). Modul-modul itu masih ada di
// modules/inventory/ untuk dipakai nanti saat backend Bujangan Food digarap.

app.use('/api', api);

app.use((req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan.' }));
app.use(errorHandler);

module.exports = app;
