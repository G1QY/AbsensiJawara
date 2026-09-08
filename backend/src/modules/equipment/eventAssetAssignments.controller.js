// GET/POST/PATCH /event-asset-assignments
const supabase = require('../../config/supabaseClient');

async function list(req, res, next) {
  try {
    const { eventId } = req.query;
    let query = supabase.from('event_asset_assignments')
      .select('*, asset:equipment_assets(asset_code, asset_type, current_condition), event:events(event_name)');
    if (eventId) query = query.eq('event_id', eventId);

    const { data, error } = await query;
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('event_asset_assignments').insert({ ...req.body, assigned_at: new Date().toISOString() }).select().single();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    await supabase.from('equipment_assets').update({ status: 'IN_USE' }).eq('id', req.body.asset_id);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('event_asset_assignments').update(req.body).eq('id', req.params.id).select().maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'Data tidak ditemukan.' });

    if (req.body.returned_at) {
      await supabase.from('equipment_assets').update({
        current_condition: req.body.return_condition || 'GOOD',
        status: req.body.return_condition === 'DAMAGED' || req.body.return_condition === 'LOST' ? 'MAINTENANCE' : 'AVAILABLE',
      }).eq('id', data.asset_id);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
