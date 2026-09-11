// Run from frontend after npm run build. This tests UI with explicit mock API fixtures.
const { chromium } = require(
  process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright",
)
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict")
const output = require("./qa-output.cjs")
const root = path.resolve("dist")
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://localhost").pathname
  const file = path.join(root, p === "/" ? "index.html" : p)
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404)
      return res.end()
    }
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".jpg")
            ? "image/jpeg"
            : "text/html",
    )
    res.end(data)
  })
})
;(async () => {
  const binary = (await import(process.env.CHROMIUM_MODULE)).default
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const origin = "http://127.0.0.1:" + server.address().port
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE || await binary.executablePath(),
      args: binary.args,
    })
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    const calls = []
    const user = {
      id: "admin-test",
      full_name: "Admin Uji",
      email: "admin@example.test",
      phone: "081234567890",
    }
    const directory = {
      branches: [
        { id: "branch-jkt", code: "JKT", name: "Jakarta" },
        { id: "branch-bdg", code: "BDG", name: "Bandung" },
      ],
      stores: [
        {
          id: "store-1",
          branch_id: "branch-jkt",
          code: "GACOAN",
          name: "Store Pengujian Jakarta",
          address: "Alamat pengujian",
          latitude: -6.2,
          longitude: 106.8,
          radius_meters: 50,
          status: "ACTIVE",
        },
        {
          id: "store-2",
          branch_id: "branch-bdg",
          code: "TEST-S2",
          name: "Store Pengujian Bandung",
          address: "Alamat pengujian",
          latitude: -6.9,
          longitude: 107.6,
          radius_meters: 50,
          status: "ACTIVE",
        },
      ],
      events: [
        {
          id: "event-1",
          branch_id: "branch-bdg",
          event_code: "BDG-WEX",
          event_name: "Event Pengujian Bandung",
          event_date: "2026-09-01",
          client_name: "Klien Uji",
          status: "SCHEDULED",
        },
      ],
    }
    let rows = [
      {
        id: "crew-1",
        employee_code: "TEST-01",
        crew_type: "CREW_STORE",
        status: "ACTIVE",
        base_salary: 0,
        branch_id: "branch-jkt",
        branch: directory.branches[0],
        user: {
          id: "user-1",
          full_name: "Crew Pengujian",
          email: "crew@example.test",
          phone_number: "081234567890",
        },
        store_assignments: [
          {
            id: "as-1",
            status: "ACTIVE",
            start_date: "2026-01-01",
            end_date: null,
            store: directory.stores[0],
          },
        ],
        event_assignments: [],
      },
    ]
    let failSave = false
    let storeSchedules = []
    await page.route("**/*", async (r) => {
      const url = new URL(r.request().url())
      if (url.origin === origin) return r.continue()
      if (!url.pathname.startsWith("/api/")) return r.abort()
      const method = r.request().method(),
        p = url.pathname
      const body = r.request().postData() ? r.request().postDataJSON() : {}
      calls.push({ method, p, body })
      let data = [],
        status = 200
      if (p === "/api/auth/login")
        data = {
          token: "fixture-token",
          refreshToken: "fixture-refresh",
          user,
          role: "SUPER_ADMIN",
        }
      else if (p === "/api/users/me") data = user
      else if (p === "/api/admin-directory") data = directory
      else if (p === "/api/admin-events") data = []
      else if (p === "/api/admin-attendance") data = { registered: [], guest: [] }
      else if (p === "/api/admin-store-schedules/crew/crew-1") data = { assignment: rows[0].store_assignments[0], schedules: storeSchedules }
      else if (p === "/api/admin-store-schedules" && method === "POST") { const saved = { id: "schedule-1", schedule_date: body.scheduleDate, start_time: body.startTime, end_time: body.endTime, late_tolerance_minutes: body.lateToleranceMinutes }; storeSchedules = [saved]; data = saved; status = 201 }
      else if (p.startsWith("/api/admin-directory/"))
        data = { id: "saved", ...body }
      else if (p === "/api/crew") {
        if (method === "POST") {
          data = { id: "new-crew" }
        } else data = rows
      } else if (p === "/api/crew/crew-1") {
        if (method === "PATCH") {
          if (failSave) {
            status = 503
            data = { message: "Gagal simpan uji" }
          } else {
            rows = rows.map((c) => ({
              ...c,
              ...(body.status ? { status: body.status } : {}),
              ...(body.baseSalary !== undefined
                ? { base_salary: body.baseSalary }
                : {}),
            }))
            data = { id: "crew-1" }
          }
        } else if (method === "DELETE") {
          rows = []
          data = { message: "diarsipkan" }
        } else data = rows[0]
      } else if (p.endsWith("/reset-password"))
        data = { message: "Password tersimpan" }
      else if (p === "/api/dashboard/admin")
        data = {
          totalCrew: 1,
          hadirHariIni: 0,
          telatHariIni: 0,
          eventOngoing: 0,
          date: "2026-08-31",
        }
      else if (p === "/api/auth/logout") data = { message: "ok" }
      return r.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      })
    })
    await page.goto(origin)
    await page.locator("#email").fill(user.email)
    await page.locator("#password").fill("test-password")
    await page.getByRole("button", { name: "Log in", exact: true }).click()
    await page.getByText("Store Pengujian Jakarta", { exact: true }).waitFor()
    for (const label of [
      "Dashboard",
      "Kelola Crew",
      "Kelola Event",
      "Absensi",
      "Payroll",
      "Laporan",
      "Audit Log",
    ])
      assert.equal(
        await page
          .locator("aside:visible")
          .getByRole("button", { name: label, exact: true })
          .count(),
        1,
        label,
      )
    assert.equal(
      await page
        .getByRole("columnheader", { name: "Email", exact: true })
        .count(),
      1,
    )
    assert.equal(
      await page
        .getByRole("columnheader", { name: "Password", exact: true })
        .count(),
      1,
    )
    await page
      .getByRole("button", { name: "+ Tambah Crew", exact: true })
      .click()
    let dialog = page.getByRole("dialog")
    const salary = dialog.getByLabel("Gaji Pokok (Rp)", { exact: true })
    assert.equal(await salary.inputValue(), "0")
    assert.equal(await salary.getAttribute("type"), "text")
    await salary.fill("")
    assert.equal(await salary.inputValue(), "")
    await salary.pressSequentially("0111")
    assert.equal(await salary.inputValue(), "111")
    await salary.fill("")
    await dialog.getByLabel("Nama Lengkap", { exact: true }).fill("Crew Baru")
    assert.equal(await salary.inputValue(), "0")
    await dialog.getByLabel("Email", { exact: true }).fill("new@example.test")
    await dialog
      .getByLabel("Password Awal", { exact: true })
      .fill("test-password")
    await dialog
      .getByLabel("Jenis Crew", { exact: true })
      .selectOption("CREW_STORE")
    await dialog
      .getByLabel("Kantor Cabang", { exact: true })
      .selectOption("branch-jkt")
    const location = dialog.getByLabel("Store Penugasan", { exact: true })
    assert.equal(await location.locator("option").count(), 2)
    assert.ok(!(await location.innerText()).includes("Bandung"))
    await location.selectOption("store-1")
    assert.equal(
      await dialog.getByLabel("Kode Karyawan", { exact: true }).inputValue(),
      "JKT-GACOAN-1",
    )
    await page.screenshot({
      animations: "disabled",
      path: output + "/admin-add-crew-code.png",
    })
    await dialog
      .getByRole("button", { name: "Simpan Crew", exact: true })
      .click()
    await dialog.waitFor({ state: "hidden" })
    const creation = calls.find(
      (c) => c.method === "POST" && c.p === "/api/crew",
    )
    assert.equal(creation.body.baseSalary, 0)
    assert.equal(creation.body.assignTo, "store-1")
    assert.equal(creation.body.email, "new@example.test")
    assert.equal(creation.body.employeeNumber, undefined)
    assert.equal(creation.body.employeeCode, "JKT-GACOAN-1")
    await page.getByRole("button", { name: "+ Tambah Crew", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog.getByLabel("Kantor Cabang", { exact: true }).selectOption("branch-bdg")
    await dialog.getByLabel("Acuan Kode Event", { exact: true }).selectOption("event-1")
    assert.equal(
      await dialog.getByLabel("Kode Karyawan", { exact: true }).inputValue(),
      "BDG-WEX-1",
    )
    assert.equal(await dialog.getByLabel("Nomor Karyawan", { exact: true }).count(), 0)
    assert.equal(await dialog.getByLabel("Posisi / Tugas", { exact: true }).count(), 0)
    await dialog.getByRole("button", { name: "Batal", exact: true }).click()
    await page.getByRole("button", { name: "Detail", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog
      .getByRole("heading", { name: "Crew Pengujian", exact: true })
      .waitFor()
    await dialog.getByRole("button", { name: "Atur Jadwal Store", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog.getByText("Store aktif:").waitFor()
    await dialog.getByLabel("Tanggal kerja", { exact: true }).fill("2026-09-01")
    await dialog.getByLabel("Jam masuk", { exact: true }).fill("10:00")
    await dialog.getByLabel("Jam pulang", { exact: true }).fill("18:00")
    await dialog.getByRole("button", { name: "Simpan Jadwal Store", exact: true }).click()
    await dialog.getByRole("status").waitFor()
    assert.ok(calls.some(c=>c.p==="/api/admin-store-schedules"&&c.body.startTime==="10:00"))
    await dialog.getByRole("button", { name: "Tutup dialog", exact: true }).click()
    await page.getByRole("button", { name: "Detail", exact: true }).click()
    dialog = page.getByRole("dialog")
    await page.screenshot({
      animations: "disabled",
      path: output + "/admin-detail-light.png",
    })
    await dialog.getByRole("button", { name: "Edit", exact: true }).click()
    dialog = page.getByRole("dialog")
    assert.ok(
      (await dialog
        .getByLabel("Email", { exact: true })
        .getAttribute("readonly")) === null,
    )
    failSave = true
    await dialog.getByLabel("Gaji Pokok (Rp)", { exact: true }).fill("2500000")
    await dialog
      .getByRole("button", { name: "Simpan Crew", exact: true })
      .click()
    await dialog.getByRole("alert").getByText("Gagal simpan uji").waitFor()
    assert.equal(
      await dialog.getByLabel("Gaji Pokok (Rp)", { exact: true }).inputValue(),
      "2500000",
    )
    failSave = false
    await dialog
      .getByRole("button", { name: "Simpan Crew", exact: true })
      .click()
    await dialog.waitFor({ state: "hidden" })
    await page.getByText("Rp2.500.000", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Detail", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: "Atur Password", exact: true })
      .click()
    await dialog
      .getByLabel("Password Baru", { exact: true })
      .fill("reset-password")
    await dialog
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click()
    await dialog
      .getByRole("button", { name: "Atur Password", exact: true })
      .waitFor()
    assert.ok(
      calls.some(
        (c) =>
          c.p.endsWith("/reset-password") &&
          c.body.newPassword === "reset-password",
      ),
    )
    await dialog
      .getByRole("button", { name: "Nonaktifkan", exact: true })
      .click()
    await dialog.getByRole("button", { name: "Batal", exact: true }).click()
    assert.ok(!calls.some((c) => c.body.status === "INACTIVE"))
    await dialog
      .getByRole("button", { name: "Nonaktifkan", exact: true })
      .click()
    await dialog
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click()
    await dialog.waitFor({ state: "hidden" })
    assert.equal(rows[0].status, "INACTIVE")
    await page
      .getByRole("button", { name: "Ubah ke tema gelap", exact: true })
      .click()
    await page.getByRole("button", { name: "Detail", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog
      .getByRole("button", { name: "Aktifkan", exact: true })
      .waitFor()
    await page.screenshot({
      animations: "disabled",
      path: output + "/admin-detail-dark.png",
    })
    await dialog
      .getByRole("button", { name: "Tutup dialog", exact: true })
      .click()
    await page
      .getByRole("button", { name: "Cabang & Store", exact: true })
      .click()
    dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Cabang", exact: true }).click()
    await dialog.getByLabel("Kode", { exact: true }).fill("SBY")
    await dialog.getByLabel("Nama Cabang", { exact: true }).fill("Surabaya Uji")
    await dialog
      .getByRole("button", { name: "Simpan Cabang", exact: true })
      .click()
    await dialog.getByRole("status").waitFor()
    assert.ok(
      calls.some(
        (c) =>
          c.p === "/api/admin-directory/branches" &&
          c.body.name === "Surabaya Uji",
      ),
    )
    await dialog
      .getByRole("button", { name: "Tutup dialog", exact: true })
      .click()
    for (const label of [
      "Dashboard",
      "Kelola Event",
      "Payroll",
      "Laporan",
      "Audit Log",
    ]) {
      await page
        .locator("aside:visible")
        .getByRole("button", { name: label, exact: true })
        .click()
      await page
        .getByRole("heading", { name: label, exact: true })
        .first()
        .waitFor()
      await page
        .getByRole("button", { name: "Muat ulang", exact: true })
        .waitFor()
    }
    await page
      .locator("aside:visible")
      .getByRole("button", { name: "Kelola Crew", exact: true })
      .click()
    await page.getByRole("button", { name: "Detail", exact: true }).waitFor()
    await page.screenshot({
      animations: "disabled",
      path: output + "/admin-crew-dark.png",
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page
      .getByRole("button", { name: "+ Tambah Crew", exact: true })
      .click()
    dialog = page.getByRole("dialog")
    await dialog.getByLabel("Nama Lengkap", { exact: true }).fill("Mobile Uji")
    await page.screenshot({
      animations: "disabled",
      path: output + "/admin-form-mobile.png",
    })
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    )
    await dialog.getByRole("button", { name: "Batal", exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.getByRole("button", { name: "Detail", exact: true }).click()
    dialog = page.getByRole("dialog")
    await dialog.getByRole("button", { name: "Hapus", exact: true }).click()
    await dialog
      .getByRole("button", { name: "Konfirmasi", exact: true })
      .click()
    await dialog.waitFor({ state: "hidden" })
    await page.getByText("Tidak ada crew ditemukan.", { exact: true }).waitFor()
    assert.deepEqual(errors, [])
    console.log(
      "PASS: admin menus, table, branch-filtered assignments, zero/clearable salary, create payload, detail, edit/error recovery, reset password, status confirmation, archive, branch create, light/dark/mobile; mock API only.",
    )
  } finally {
    await browser?.close()
    server.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
