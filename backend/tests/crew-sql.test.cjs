// Optional local integration test: PGLITE_MODULE points to an installed @electric-sql/pglite.
// No connection to a live Supabase project; fixture Auth schema exists only in memory.
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path")
test(
  "crew transaction integration on local Postgres",
  { skip: !process.env.PGLITE_MODULE },
  async () => {
    const { PGlite } = require(process.env.PGLITE_MODULE)
    const db = new PGlite()
    const migrationDir = path.resolve(__dirname, "../../supabase/migrations")
    await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;`)
    for (const name of [
      "001_foundation.sql",
      "002_workforce.sql",
      "003_attendance.sql",
    ]) {
      await db.exec(
        fs
          .readFileSync(path.join(migrationDir, name), "utf8")
          .replace('create extension if not exists "pgcrypto";', ""),
      )
    }
    await db.exec(
      `create table public.audit_logs(id uuid default gen_random_uuid(),actor_user_id uuid,action text,entity_type text,entity_id uuid,old_data jsonb,new_data jsonb,created_at timestamptz default now());`,
    )
    await db.exec(
      fs.readFileSync(
        path.join(migrationDir, "20260831110840_admin_branches_crew.sql"),
        "utf8",
      ),
    )
    const admin = "00000000-0000-4000-8000-000000000001",
      user = "00000000-0000-4000-8000-000000000002",
      user2 = "00000000-0000-4000-8000-000000000003"
    await db.exec(`insert into roles(code,name) values('SUPER_ADMIN','Admin'),('CREW_EVENT','Event'),('CREW_STORE','Store');
    insert into auth.users(id,email) values('${admin}','admin@example.test'),('${user}','crew@example.test'),('${user2}','other@example.test');
    insert into user_roles(user_id,role_id) select '${admin}',id from roles where code='SUPER_ADMIN';`)
    const branches = (await db.query("select * from branches order by code"))
      .rows
    assert.equal(branches.length, 4)
    const b = branches[0].id,
      b2 = branches[1].id
    const store = (
      await db.query(
        "insert into stores(code,name,branch_id,latitude,longitude) values('TEST-S','Test Store',$1,0,0) returning id",
        [b],
      )
    ).rows[0].id
    const event = (
      await db.query(
        "insert into events(event_code,event_name,event_date,branch_id) values('TEST-E','Test Event',current_date,$1) returning id",
        [b],
      )
    ).rows[0].id
    const rpc = async (actor, op, id, uid, body) =>
      (
        await db.query("select manage_crew($1,$2,$3,$4,$5) as id", [
          actor,
          op,
          id,
          uid,
          JSON.stringify(body),
        ])
      ).rows[0].id
    const c = await rpc(admin, "create", null, user, {
      fullName: "Crew SQL",
      employeeCode: "TEST-C",
      crewType: "CREW_STORE",
      baseSalary: 0,
      branchId: b,
      assignTo: store,
    })
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from store_assignments where crew_id=$1",
          [c],
        )
      ).rows[0].n,
      1,
    )
    await rpc(admin, "update", c, null, {
      fullName: "Crew Edited",
      baseSalary: 120000,
      assignTo: store,
      branchId: b,
    })
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from store_assignments where crew_id=$1",
          [c],
        )
      ).rows[0].n,
      1,
    )
    await assert.rejects(
      rpc(admin, "update", c, null, {
        fullName: "Must Rollback",
        branchId: b2,
        assignTo: store,
      }),
    )
    assert.equal(
      (await db.query("select full_name from users where id=$1", [user]))
        .rows[0].full_name,
      "Crew Edited",
    )
    await assert.rejects(rpc(user, "update", c, null, { baseSalary: 9999 }))
    await assert.rejects(
      rpc(admin, "create", null, admin, {
        employeeCode: "ADMIN-HACK",
        crewType: "CREW_STORE",
      }),
    )
    await rpc(admin, "update", c, null, { status: "INACTIVE" })
    assert.equal(
      (await db.query("select is_active from users where id=$1", [user]))
        .rows[0].is_active,
      false,
    )
    await rpc(admin, "update", c, null, {
      status: "ACTIVE",
      crewType: "CREW_EVENT",
      branchId: b,
      assignTo: event,
      position: "Fotografer",
    })
    assert.equal(
      (
        await db.query(
          "select r.code from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=$1",
          [user],
        )
      ).rows[0].code,
      "CREW_EVENT",
    )
    assert.equal(
      (
        await db.query(
          "select status from store_assignments where crew_id=$1",
          [c],
        )
      ).rows[0].status,
      "ENDED",
    )
    const assignment = (
      await db.query("select id from event_assignments where crew_id=$1", [c])
    ).rows[0].id
    await db.query(
      "insert into attendance_logs(crew_id,event_assignment_id,attendance_date,status) values($1,$2,current_date,'PENDING')",
      [c, assignment],
    )
    await assert.rejects(
      rpc(admin, "create", null, user2, {
        employeeCode: "TEST-C",
        crewType: "CREW_EVENT",
      }),
    )
    assert.equal(
      (
        await db.query("select count(*)::int as n from crew where user_id=$1", [
          user2,
        ])
      ).rows[0].n,
      0,
    )
    await rpc(admin, "archive", c, null, {})
    assert.ok(
      (await db.query("select deleted_at from crew where id=$1", [c])).rows[0]
        .deleted_at,
    )
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from attendance_logs where crew_id=$1",
          [c],
        )
      ).rows[0].n,
      1,
    )
    assert.equal(
      (await db.query("select is_active from users where id=$1", [user]))
        .rows[0].is_active,
      false,
    )
    await assert.rejects(rpc(admin, "update", c, null, { status: "ACTIVE" }))
    const grants = (
      await db.query(
        "select has_function_privilege('authenticated','public.manage_crew(uuid,text,uuid,uuid,jsonb)','EXECUTE') as auth, has_function_privilege('anon','public.manage_crew(uuid,text,uuid,uuid,jsonb)','EXECUTE') as anon, has_function_privilege('service_role','public.manage_crew(uuid,text,uuid,uuid,jsonb)','EXECUTE') as service",
      )
    ).rows[0]
    assert.deepEqual(grants, { auth: false, anon: false, service: true })
    assert.ok(
      (await db.query("select count(*)::int as n from audit_logs")).rows[0].n >=
        5,
    )
    await db.close()
  },
)
