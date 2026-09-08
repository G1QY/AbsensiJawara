const db = require("../../config/supabaseClient")
const { logAudit } = require("../../utils/auditLogger")
const {
  validateCrew,
  validatePassword,
  fail,
  uuid,
} = require("./crew.validation")
const { avatarPattern } = require("../profile/profile.service")
const { getSignedDownloadUrl } = require("../../utils/signedUrl")
const selection = `*, user:users(id,full_name,email,phone_number), branch:branches(id,name),
  store_assignments(id,status,start_date,end_date,store:stores(id,name,branch_id)),
  event_assignments(id,status,position,event:events(id,event_code,event_name,event_date,status,branch_id))`
function check(error) {
  if (!error) return
  if (error.code === "23505")
    throw fail("Email atau kode karyawan sudah digunakan.", 409)
  if (error.code === "P0002") throw fail(error.message, 404)
  if (error.code === "42501") throw fail(error.message, 403)
  if (
    error.code?.startsWith("PGRST") ||
    error.code === "42703" ||
    error.code === "42P01"
  )
    throw fail(
      "Struktur database belum sesuai. Jalankan migrasi admin_branches_crew lalu muat ulang.",
      503,
    )
  throw fail(error.message, 400)
}
async function fetchCrew(id) {
  const { data, error } = await db
    .from("crew")
    .select(selection)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  check(error)
  if (!data) throw fail("Crew tidak ditemukan.", 404)
  return data
}
async function list(req, res, next) {
  try {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db
        .from("crew")
        .select(selection)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499)
      check(error)
      rows.push(...data)
      if (data.length < 500) break
    }
    res.json(rows)
  } catch (error) {
    next(error)
  }
}
async function detail(req, res, next) {
  try {
    uuid(req.params.id)
    const crew = await fetchCrew(req.params.id)
    const { data, error } = await db.auth.admin.getUserById(crew.user_id)
    if (error) throw fail("Akun crew belum dapat dimuat.", 503)
    const key = data.user?.user_metadata?.avatar_key
    const avatarUrl =
      typeof key === "string" && avatarPattern(crew.user_id).test(key)
        ? await getSignedDownloadUrl(key, 3600)
        : ""
    res.json({ ...crew, avatarUrl })
  } catch (error) {
    next(error)
  }
}
async function mutate(req, operation, userId, body) {
  const { data, error } = await db.rpc("manage_crew", {
    p_actor_id: req.user.id,
    p_operation: operation,
    p_crew_id: req.params.id || null,
    p_user_id: userId || null,
    p_data: body,
  })
  check(error)
  return data
}
function codePart(value, label) {
  const clean = typeof value === "string" ? value.trim().toUpperCase() : ""
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(clean))
    throw fail(`${label} harus memakai huruf, angka, atau tanda hubung agar dapat dipakai sebagai kode karyawan.`)
  return clean
}
async function employeeCode(fields) {
  if (!fields.branchId) throw fail("Pilih kantor cabang untuk membuat kode karyawan.")
  const { data: branch, error: branchError } = await db.from("branches").select("code").eq("id", fields.branchId).maybeSingle()
  check(branchError)
  if (!branch) throw fail("Kantor cabang tidak ditemukan.")
  const branchCode = codePart(branch.code, "Kode Cabang")
  let prefix
  if (fields.crewType === "CREW_STORE") {
    if (!fields.assignTo) throw fail("Pilih Store untuk membuat kode Crew Store.")
    const { data: store, error } = await db.from("stores").select("code,branch_id,status").eq("id", fields.assignTo).maybeSingle()
    check(error)
    if (!store || store.status !== "ACTIVE") throw fail("Store tidak ditemukan atau tidak aktif.")
    if (!fields.branchId || store.branch_id !== fields.branchId) throw fail("Store tidak berada di kantor cabang yang dipilih.")
    const storeCode = codePart(store.code, "Kode Store")
    const storeSegment = storeCode.startsWith(`${branchCode}-`) ? storeCode.slice(branchCode.length + 1) : storeCode
    if (!storeSegment) throw fail("Kode Store belum memiliki singkatan yang dapat dipakai.")
    prefix = `${branchCode}-${storeSegment}`
  } else {
    if (fields.assignTo) throw fail("Penugasan Crew Event hanya dilakukan melalui Kelola Event.")
    if (fields.codeSourceId) {
      const { data: event, error } = await db.from("events").select("event_code,branch_id,status").eq("id", fields.codeSourceId).maybeSingle()
      check(error)
      if (!event || !["SCHEDULED", "ONGOING"].includes(event.status)) throw fail("Event acuan tidak ditemukan atau tidak aktif.")
      if (event.branch_id !== fields.branchId) throw fail("Event acuan tidak berada di kantor cabang yang dipilih.")
      const eventCode = codePart(event.event_code, "Kode Event")
      prefix = eventCode.startsWith(`${branchCode}-`) ? eventCode : `${branchCode}-${eventCode}`
    } else throw fail("Pilih Event acuan untuk membuat kode Crew Event.")
  }
  const result = codePart(fields.employeeCode || `${prefix}-${fields.employeeNumber}`, "Kode Karyawan")
  if (result.length > 30) throw fail("Kode lokasi terlalu panjang. Pendekkan kode Cabang atau Store agar kode karyawan maksimal 30 karakter.")
  if (!result.startsWith(`${branchCode}-`)) throw fail(`Kode karyawan harus diawali ${branchCode} sesuai kantor cabang.`)
  if (!new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[1-9]\\d*$`).test(result))
    throw fail(`Kode karyawan harus memakai format ${prefix}-ANGKA.`)
  return result
}
async function create(req, res, next) {
  let createdId
  let committed = false
  try {
    const fields = validateCrew(req.body, true)
    fields.employeeCode = await employeeCode(fields)
    delete fields.employeeNumber
    delete fields.codeSourceId
    const email = req.body.email.trim().toLowerCase()
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: req.body.password,
      email_confirm: true,
      user_metadata: {
        full_name: fields.fullName,
        phone_number: fields.phoneNumber,
      },
    })
    if (error) throw fail(error.message, 400)
    createdId = data.user.id
    const id = await mutate(req, "create", createdId, fields)
    committed = true
    res.status(201).json({ id })
  } catch (error) {
    if (createdId && !committed) {
      const rollback = await db.auth.admin
        .deleteUser(createdId)
        .catch(() => ({ error: true }))
      if (rollback.error)
        error.message +=
          " Akun Auth belum dapat dibatalkan; hubungi admin sebelum mencoba email yang sama."
    }
    next(error)
  }
}
async function update(req, res, next) {
  try {
    uuid(req.params.id)
    const fields = validateCrew(req.body)
    let current
    if (fields.employeeCode !== undefined || fields.assignTo) {
      current = await fetchCrew(req.params.id)
      const crewType = fields.crewType || current.crew_type
      if (crewType === "CREW_EVENT" && fields.assignTo)
        throw fail("Penugasan Crew Event hanya dilakukan melalui Kelola Event.")
      if (fields.employeeCode !== undefined) {
        fields.employeeCode = await employeeCode({
          ...fields,
          crewType,
          branchId: fields.branchId || current.branch_id,
          assignTo:
            fields.assignTo !== undefined
              ? fields.assignTo
              : current.store_assignments?.find((a) => a.status === "ACTIVE")
                  ?.store?.id || null,
        })
      }
    }
    delete fields.employeeNumber
    delete fields.codeSourceId
    const id = await mutate(req, "update", null, fields)
    res.json({ id })
  } catch (error) {
    next(error)
  }
}
async function archive(req, res, next) {
  try {
    uuid(req.params.id)
    await mutate(req, "archive", null, {})
    res.json({
      message:
        "Crew diarsipkan. Akses login ditutup; riwayat absensi dipertahankan.",
    })
  } catch (error) {
    next(error)
  }
}
async function resetPassword(req, res, next) {
  try {
    uuid(req.params.id)
    validatePassword(req.body.newPassword)
    const crew = await fetchCrew(req.params.id)
    const { data: roles, error: roleError } = await db
      .from("user_roles")
      .select("role:roles(code)")
      .eq("user_id", crew.user_id)
    check(roleError)
    if (
      crew.user_id === req.user.id ||
      roles.some((r) => !["CREW_EVENT", "CREW_STORE"].includes(r.role?.code))
    )
      throw fail("Akun admin tidak boleh diubah lewat Kelola Crew.", 403)
    const { error } = await db.auth.admin.updateUserById(crew.user_id, {
      password: req.body.newPassword,
    })
    check(error)
    await logAudit({
      actorUserId: req.user.id,
      action: "CREW_PASSWORD_RESET",
      entityType: "crew",
      entityId: crew.id,
    })
    res.json({
      message:
        "Password baru tersimpan. Sampaikan langsung kepada pemilik akun.",
    })
  } catch (error) {
    next(error)
  }
}
async function updateEmail(req,res,next) {
  try {
    uuid(req.params.id)
    const {email,expectedEmail}=req.body
    if(typeof email!=='string'||email.trim().length>150||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw fail('Email tidak valid.')
    const crew=await fetchCrew(req.params.id)
    const {data:roles,error:roleError}=await db.from('user_roles').select('role:roles(code)').eq('user_id',crew.user_id)
    check(roleError)
    if(crew.user_id===req.user.id||!roles?.length||roles.some(r=>!['CREW_EVENT','CREW_STORE'].includes(r.role?.code)))throw fail('Hanya email akun crew yang dapat diubah di sini.',403)
    const {data:auth,error:authError}=await db.auth.admin.getUserById(crew.user_id)
    check(authError)
    const previous=auth.user.email
    if(previous!==expectedEmail)throw fail('Email telah berubah. Muat ulang detail crew.',409)
    const clean=email.trim().toLowerCase()
    const {error}=await db.auth.admin.updateUserById(crew.user_id,{email:clean,email_confirm:true})
    check(error)
    const sync=await db.from('users').update({email:clean}).eq('id',crew.user_id)
    if(sync.error){
      const rollback=await db.auth.admin.updateUserById(crew.user_id,{email:previous,email_confirm:true})
      if(rollback.error)throw fail('Email Auth berubah tetapi profil belum sinkron. Jangan ulangi perubahan; hubungi admin untuk rekonsiliasi.',503)
      check(sync.error)
    }
    await db.from('password_reset_otps').update({used:true}).in('email',[previous,clean])
    await logAudit({actorUserId:req.user.id,action:'CREW_EMAIL_CHANGED',entityType:'crew',entityId:crew.id,oldData:{email:previous},newData:{email:clean}})
    res.json({email:clean,message:'Email login crew diperbarui. Gunakan email baru saat login.'})
  }catch(error){next(error)}
}
module.exports = { list, detail, create, update, archive, resetPassword, updateEmail }
