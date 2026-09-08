const test = require("node:test"),
  assert = require("node:assert/strict")
const dbPath = require.resolve("../src/config/supabaseClient")
const signedPath = require.resolve("../src/utils/signedUrl")
const operations = []
let rpcError = null
let rollbackCalls = 0
const actor = "00000000-0000-4000-8000-000000000001",
  crewId = "00000000-0000-4000-8000-000000000002",
  userId = "00000000-0000-4000-8000-000000000003"
const db = {
  rpc: async (name, args) => {
    operations.push({ name, args })
    return { data: crewId, error: rpcError }
  },
  from(table) {
    let action = "select"
    const query = {
      select() {
        return query
      },
      insert(body) {
        action = "insert"
        operations.push({ table, body })
        return query
      },
      eq() {
        return query
      },
      is() {
        return query
      },
      order() {
        return query
      },
      range() {
        return query
      },
      maybeSingle() {
        if (table === "branches") return Promise.resolve({ data: { code: "BDG" }, error: null })
        if (table === "stores") return Promise.resolve({ data: { code: "GACOAN", branch_id: actor, status: "ACTIVE" }, error: null })
        if (table === "events") return Promise.resolve({ data: { event_code: "BDG-SMA1", branch_id: actor, status: "SCHEDULED" }, error: null })
        return Promise.resolve({
          data: { id: crewId, user_id: userId },
          error: null,
        })
      },
      then(resolve, reject) {
        return Promise.resolve({
          data:
            table === "user_roles" ? [{ role: { code: "CREW_EVENT" } }] : [],
          error: null,
        }).then(resolve, reject)
      },
    }
    return query
  },
  auth: {
    admin: {
      createUser: async (body) => {
        operations.push({ create: body })
        return { data: { user: { id: userId } }, error: null }
      },
      deleteUser: async () => {
        rollbackCalls++
        return { error: null }
      },
      getUserById: async () => ({
        data: { user: { id: userId, user_metadata: {} } },
        error: null,
      }),
      updateUserById: async (id, body) => {
        operations.push({ passwordUpdate: id, body })
        return { error: null }
      },
    },
  },
}
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: db,
}
require.cache[signedPath] = {
  id: signedPath,
  filename: signedPath,
  loaded: true,
  exports: { getSignedDownloadUrl: async () => "" },
}
const express = require("express")
const router = require("../src/modules/crew/crew.routes")
test("HTTP crew routes enforce admin role, transaction, password handling and rollback", async () => {
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    req.user = { id: actor }
    req.role = req.headers["x-test-role"] || "CREW_EVENT"
    next()
  })
  app.use("/crew", router)
  app.use((err, req, res, next) =>
    res.status(err.status || 500).json({ message: err.message }),
  )
  const server = app.listen(0, "127.0.0.1")
  await new Promise((r) => server.once("listening", r))
  const url = "http://127.0.0.1:" + server.address().port
  const call = (path, method, body, role = "SUPER_ADMIN") =>
    fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", "x-test-role": role },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  try {
    for (const [method, path] of [
      ["GET", "/crew"],
      ["GET", "/crew/" + crewId],
      ["POST", "/crew"],
      ["PATCH", "/crew/" + crewId],
      ["DELETE", "/crew/" + crewId],
      ["PATCH", "/crew/" + crewId + "/reset-password"],
    ])
      assert.equal(
        (await call(path, method, undefined, "CREW_EVENT")).status,
        403,
      )
    const body = {
      fullName: "API Crew",
      employeeCode: "BDG-SMA1-1",
      crewType: "CREW_EVENT",
      branchId: actor,
      codeSourceId: crewId,
      email: "api@example.test",
      password: "test-password",
    }
    assert.equal((await call("/crew", "POST", body)).status, 201)
    const rpc = operations.find((o) => o.name === "manage_crew")
    assert.equal(rpc.args.p_actor_id, actor)
    assert.equal(rpc.args.p_data.password, undefined)
    assert.equal(rpc.args.p_data.baseSalary, 0)
    assert.equal(rpc.args.p_data.employeeCode, "BDG-SMA1-1")
    assert.equal(rpc.args.p_data.codeSourceId, undefined)
    assert.equal(rpc.args.p_data.employeeNumber, undefined)
    assert.equal(rollbackCalls, 0)
    const storeBody = { ...body, email: "store@example.test", crewType: "CREW_STORE", employeeCode: "BDG-GACOAN-1", codeSourceId: null, assignTo: crewId }
    assert.equal((await call("/crew", "POST", storeBody)).status, 201)
    const storeRpc = operations.filter((o) => o.name === "manage_crew").at(-1)
    assert.equal(storeRpc.args.p_data.employeeCode, "BDG-GACOAN-1")
    const editedCode = await call("/crew/" + crewId, "PATCH", { crewType: "CREW_EVENT", branchId: actor, codeSourceId: crewId, employeeCode: "bdg-sma1-9" })
    assert.equal(editedCode.status, 200)
    assert.equal(operations.filter((o) => o.name === "manage_crew").at(-1).args.p_data.employeeCode, "BDG-SMA1-9")
    assert.equal((await call("/crew", "POST", { ...body, email: "badassign@example.test", assignTo: crewId })).status, 422)
    rpcError = { code: "23505", message: "duplicate" }
    assert.equal((await call("/crew", "POST", body)).status, 409)
    assert.equal(rollbackCalls, 1)
    rpcError = null
    assert.equal(
      (await call("/crew/" + crewId, "PATCH", { status: "INACTIVE" })).status,
      200,
    )
    assert.equal((await call("/crew/" + crewId, "DELETE")).status, 200)
    assert.equal(
      (
        await call("/crew/" + crewId + "/reset-password", "PATCH", {
          newPassword: "another-password",
        })
      ).status,
      200,
    )
    assert.ok(operations.some((o) => o.passwordUpdate === userId))
    assert.ok(
      !JSON.stringify(
        operations.filter((o) => o.table === "audit_logs"),
      ).includes("another-password"),
    )
    assert.equal(
      (await call("/crew/" + crewId, "PATCH", { baseSalary: -1 })).status,
      422,
    )
    assert.equal(
      (await call("/crew/" + crewId, "PATCH", { email: "change@example.test" }))
        .status,
      422,
    )
  } finally {
    await new Promise((r) => server.close(r))
  }
})
test("authenticate rejects inactive account even with a valid Auth token", async () => {
  const authenticate = require("../src/middlewares/authenticate")
  db.auth.getUser = async () => ({
    data: { user: { id: userId, email: "api@example.test" } },
    error: null,
  })
  const saved = db.from
  db.from = () => ({
    select() {
      return this
    },
    eq() {
      return this
    },
    maybeSingle: async () => ({ data: { is_active: false }, error: null }),
  })
  try {
    let status
    let next = false
    await authenticate(
      { headers: { authorization: "Bearer valid-token" } },
      {
        status(s) {
          status = s
          return this
        },
        json(body) {
          return body
        },
      },
      () => {
        next = true
      },
    )
    assert.equal(status, 401)
    assert.equal(next, false)
  } finally {
    db.from = saved
  }
})
