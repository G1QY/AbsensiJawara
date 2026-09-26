// Event managers operate events and their own employee workspace.
// Keep this boundary before the legacy/global routers as well as their UI.
function eventManagerBoundary(req, res, next) {
  if (req.role !== 'EVENT_MANAGER') return next();
  const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  const within = base => path === base || path.startsWith(base + '/');
  const personal = ['/users/me', '/notifications', '/attendance', '/crew-store/workspace'];
  const event = ['/admin-events', '/event-workflows', '/locations'];
  const read = req.method === 'GET' || req.method === 'HEAD';
  if (personal.some(within) || event.some(within) || within('/admin-attendance')) return next();
  if (read && (within('/crew') || path === '/admin-directory' || path === '/payroll/me' || within('/payroll/event'))) return next();
  return res.status(403).json({message: 'Event Manager hanya dapat mengelola event, absensi event, dan data pribadinya.'});
}

function eventAttendance(row, kind, actorId) {
  if (kind === 'guest') return row.crew_type === 'CREW_EVENT' && (row.assignment_kind === 'EVENT' || row.assignment_kind == null);
  return !!row.event_assignment_id && row.crew?.user_id !== actorId;
}

module.exports = {eventManagerBoundary, eventAttendance};
