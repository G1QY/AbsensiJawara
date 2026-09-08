// Correction membutuhkan approval — perubahan dicatat ke audit_logs.
const supabase = require('../../config/supabaseClient');
const { logAudit } = require('../../utils/auditLogger');

async function list(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('*, crew:crew(employee_code, user:users(full_name))');

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase.from('attendance_corrections').insert(req.body).select().single();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { status } = req.body;

    const { data: correction, error: fetchErr } = await supabase
      .from('attendance_corrections').select('*').eq('id', req.params.id).single();
    if (fetchErr || !correction) return res.status(404).json({ message: 'Data tidak ditemukan.' });

    const { data: updated, error } = await supabase
      .from('attendance_corrections')
      .update({ status, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    let oldAttendance = null;
    if (status === 'APPROVED') {
      const { data: prev } = await supabase.from('attendance_logs').select('check_in, check_out').eq('id', correction.attendance_id).single();
      oldAttendance = prev;
      await supabase.from('attendance_logs').update({
        check_in: correction.requested_check_in ?? prev?.check_in,
        check_out: correction.requested_check_out ?? prev?.check_out,
      }).eq('id', correction.attendance_id);
    }

    await logAudit({
      actorUserId: req.user.id,
      action: `ATTENDANCE_CORRECTION_${status}`,
      entityType: 'attendance_logs',
      entityId: correction.attendance_id,
      oldData: oldAttendance,
      newData: { requested_check_in: correction.requested_check_in, requested_check_out: correction.requested_check_out },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
