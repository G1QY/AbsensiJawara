const router = require("express").Router()
const db = require("../../config/supabaseClient")
const requireRole = require("../../middlewares/requireRole")
const { ROLES } = require("../../config/constants")
const { fail, uuid } = require("./crew.validation")
const { logAudit } = require("../../utils/auditLogger")
router.use(
  requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN_STORE, ROLES.EVENT_MANAGER),
)
async function all(table) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 499)
    if (error)
      throw fail(
        "Direktori belum dapat dimuat. Pastikan migrasi admin_branches_crew sudah dijalankan.",
        503,
      )
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
router.get("/", async (req, res, next) => {
  try {
    const [branches, stores, events] = await Promise.all(
      ["branches", "stores", "events"].map(all),
    )
    res.json({ branches, stores, events })
  } catch (error) {
    next(error)
  }
})
function text(body, key, max) {
  if (
    typeof body[key] !== "string" ||
    !body[key].trim() ||
    body[key].trim().length > max
  )
    throw fail(`${key} wajib diisi (maksimal ${max} karakter).`)
  return body[key].trim()
}
async function save(req, res, next) {
  try {
    const table = req.params.kind
    if (!["branches", "stores", "events"].includes(table))
      throw fail("Jenis direktori tidak valid.", 404)
    if (req.params.id) uuid(req.params.id)
    const body = req.body
    let fields
    if (table === "branches")
      fields = { code: text(body, "code", 30), name: text(body, "name", 150) }
    else {
      const branch_id = uuid(body.branch_id)
      const { data: branch, error: branchError } = await db
        .from("branches")
        .select("id")
        .eq("id", branch_id)
        .maybeSingle()
      if (branchError) throw fail("Cabang belum dapat diperiksa.", 503)
      if (!branch) throw fail("Cabang tidak ditemukan.")
      if (table === "stores") {
        const location_kind = body.location_kind || "STORE";
        if (!["STORE", "OFFICE"].includes(location_kind)) throw fail("Jenis lokasi tidak valid.");
        if (req.params.id) {
          const { data: existing, error } = await db.from("stores").select("location_kind").eq("id", req.params.id).maybeSingle();
          if (error) throw fail("Jenis lokasi belum dapat diperiksa.", 503);
          if (existing && existing.location_kind !== location_kind) throw fail("Jenis lokasi tidak dapat diubah. Buat lokasi baru untuk menjaga riwayat.");
        }
        const { latitude, longitude, radius_meters } = body
        if (
          typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          Math.abs(latitude) > 90 ||
          typeof longitude !== "number" ||
          !Number.isFinite(longitude) ||
          Math.abs(longitude) > 180
        )
          throw fail("Koordinat GPS store tidak valid.")
        if (
          !Number.isInteger(radius_meters) ||
          radius_meters < 1 ||
          radius_meters > 10000
        )
          throw fail("Radius harus 1–10000 meter.")
        if (!["ACTIVE", "INACTIVE"].includes(body.status))
          throw fail("Status store tidak valid.")
        fields = {
          location_kind,
          branch_id,
          code: text(body, "code", 30),
          name: text(body, "name", 150),
          address: text(body, "address", 1000),
          latitude,
          longitude,
          radius_meters,
          status: body.status,
        }
      } else {
        const event_date = body.event_date
        if (
          typeof event_date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(event_date) ||
          !Number.isFinite(Date.parse(event_date)) ||
          new Date(event_date).toISOString().slice(0, 10) !== event_date
        )
          throw fail("Tanggal event tidak valid.")
        if (
          !["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"].includes(
            body.status,
          )
        )
          throw fail("Status event tidak valid.")
        fields = {
          branch_id,
          event_code: text(body, "event_code", 30),
          event_name: text(body, "event_name", 150),
          client_name:
            typeof body.client_name === "string"
              ? body.client_name.trim().slice(0, 150)
              : "",
          event_date,
          status: body.status,
        }
      }
    }
    // Prevent silently moving existing assignment locations to another branch.
    if (req.params.id && table !== "branches") {
      const { data: previous, error } = await db
        .from(table)
        .select("branch_id")
        .eq("id", req.params.id)
        .maybeSingle()
      if (error) throw fail("Data lama belum dapat diperiksa.", 503)
      if (!previous) throw fail("Data tidak ditemukan.", 404)
      if (previous.branch_id && previous.branch_id !== fields.branch_id)
        throw fail(
          "Cabang lokasi yang sudah ditetapkan tidak dapat dipindah di sini. Buat lokasi baru agar riwayat tetap akurat.",
        )
    }
    let query = req.params.id
      ? db.from(table).update(fields).eq("id", req.params.id)
      : db.from(table).insert(fields)
    const { data, error } = await query.select("*").maybeSingle()
    if (error)
      throw fail(
        error.code === "23505" ? "Kode sudah dipakai." : error.message,
        400,
      )
    if (!data) throw fail("Data tidak ditemukan.", 404)
    await logAudit({
      actorUserId: req.user.id,
      action: req.params.id ? "DIRECTORY_UPDATED" : "DIRECTORY_CREATED",
      entityType: table,
      entityId: data.id,
      newData: fields,
    })
    res.status(req.params.id ? 200 : 201).json(data)
  } catch (error) {
    next(error)
  }
}
router.delete("/:kind/:id", async (req, res, next) => {
  try {
    const table = req.params.kind;
    if (!["branches", "stores"].includes(table)) throw fail("Jenis direktori tidak valid.", 404);
    const id = uuid(req.params.id);
    const { data: previous, error: readError } = await db.from(table).select("*").eq("id", id).maybeSingle();
    if (readError) throw fail("Data belum dapat diperiksa.", 503);
    if (!previous) throw fail("Data tidak ditemukan.", 404);
    const dependencies = table === "branches"
      ? [["stores", "branch_id"], ["events", "branch_id"], ["crew", "branch_id"]]
      : [["store_assignments", "store_id"], ["guest_attendances", "store_id"]];
    for (const [related, column] of dependencies) {
      const { data, error } = await db.from(related).select("id").eq(column, id).limit(1);
      if (error) throw fail("Relasi data belum dapat diperiksa. Coba lagi.", 503);
      if (data.length) throw fail("Data masih digunakan oleh store, crew, event, atau riwayat absensi. Lepaskan penugasan yang sesuai atau nonaktifkan store melalui Edit.", 409);
    }
    const { data, error } = await db.from(table).delete().eq("id", id).select("id").maybeSingle();
    if (error) throw fail(error.code === "23503" ? "Data masih digunakan. Penghapusan dibatalkan agar riwayat tetap tersimpan." : "Data belum dapat dihapus.", error.code === "23503" ? 409 : 503);
    if (!data) throw fail("Data tidak ditemukan.", 404);
    await logAudit({ actorUserId: req.user.id, action: "DIRECTORY_DELETED", entityType: table, entityId: id, oldData: previous });
    res.json({ id, message: "Data dihapus." });
  } catch (error) { next(error); }
});
router.post("/:kind", save)
router.patch("/:kind/:id", save)
module.exports = router
