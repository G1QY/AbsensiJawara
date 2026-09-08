// Helper untuk mencatat perubahan kritis ke tabel audit_logs.
const supabase = require('../config/supabaseClient');

async function logAudit({ actorUserId, action, entityType, entityId, oldData, newData }) {
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
  if (error) console.error('[auditLogger] Gagal mencatat audit log:', error.message);
}

module.exports = { logAudit };
