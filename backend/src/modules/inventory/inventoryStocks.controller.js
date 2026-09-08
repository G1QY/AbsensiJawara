// GET/POST/PATCH /inventory-stocks
// Ref: PRD Section 5 — "ROP alert muncul saat stok mendekati ambang minimum."

const supabase = require('../../config/supabaseClient');

async function list(req, res, next) {
  try {
    const { storeId } = req.query;
    let query = supabase
      .from('inventory_stocks')
      .select('*, item:inventory_items!inner(tenant_id, item_code, name, unit, min_stock_alert)')
      .eq('item.tenant_id', req.tenantId);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query;
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    // Tandai item yang sudah di bawah/mendekati ambang minimum (ROP alert)
    const withAlert = data.map((row) => ({
      ...row,
      rop_alert: row.system_qty <= row.item.min_stock_alert,
    }));

    res.json(withAlert);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { data, error } = await supabase.from('inventory_stocks').insert(req.body).select().single();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('inventory_stocks')
      .update({ ...req.body, last_updated: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
