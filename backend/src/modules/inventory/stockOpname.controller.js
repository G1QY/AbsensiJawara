// GET/POST/PATCH /stock-opname
// Ref: PRD Section 5 — discrepancy_percent = ABS(system_qty - physical_qty) / system_qty * 100
//   <= 2% -> NORMAL
//   >  2% -> REQUIRES_ADMIN_APPROVAL
// discrepancy_percent dihitung otomatis oleh database (generated column, lihat
// database/migrations/003_inventory_bujangan_food.sql) — di sini kita hanya
// menentukan `status` awal berdasarkan threshold sebelum insert, karena generated
// column tidak bisa dipakai untuk CHECK constraint status secara langsung.

const supabase = require('../../config/supabaseClient');
const { logAudit } = require('../../utils/auditLogger');
const { STOCK_DISCREPANCY_APPROVAL_THRESHOLD_PERCENT } = require('../../config/constants');

async function list(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('stock_opname_logs')
      .select('*, item:inventory_items(item_code, name, unit), store:stores(name)')
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { storeId, itemId, systemQty, physicalQty, reason } = req.body;

    const discrepancyPercent =
      systemQty === 0 ? 0 : Math.round((Math.abs(systemQty - physicalQty) / systemQty) * 10000) / 100;

    const status =
      discrepancyPercent > STOCK_DISCREPANCY_APPROVAL_THRESHOLD_PERCENT ? 'REQUIRES_ADMIN_APPROVAL' : 'NORMAL';

    const { data, error } = await supabase
      .from('stock_opname_logs')
      .insert({
        tenant_id: req.tenantId,
        store_id: storeId,
        item_id: itemId,
        system_qty: systemQty,
        physical_qty: physicalQty,
        reason,
        status,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    res.status(201).json({ ...data, requiresApproval: status === 'REQUIRES_ADMIN_APPROVAL' });
  } catch (err) {
    next(err);
  }
}

// PATCH /stock-opname/{id} — approval oleh admin ketika discrepancy > 2%
async function update(req, res, next) {
  try {
    const { status } = req.body; // 'APPROVED' | 'REJECTED'

    const { data, error } = await supabase
      .from('stock_opname_logs')
      .update({ status })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenantId)
      .select()
      .maybeSingle();

    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) return res.status(404).json({ message: 'Data tidak ditemukan.' });

    // Jika disetujui, sinkronkan inventory_stocks.system_qty dengan physical_qty hasil opname
    if (status === 'APPROVED') {
      await supabase
        .from('inventory_stocks')
        .update({ system_qty: data.physical_qty, last_updated: new Date().toISOString() })
        .eq('item_id', data.item_id)
        .eq('store_id', data.store_id);
    }

    await logAudit({
      tenantId: req.tenantId,
      actorUserId: req.user.id,
      action: `STOCK_OPNAME_${status}`,
      entityType: 'stock_opname_logs',
      entityId: data.id,
      newData: data,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };
