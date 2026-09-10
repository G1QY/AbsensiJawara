-- =====================================================================
-- 005_audit_rls.sql — FotoSnaps DB
-- audit_logs, notifications, dan Row Level Security berbasis auth.uid()
-- (tidak pakai tenant_id — database ini sudah khusus satu perusahaan).
-- =====================================================================

create table audit_logs (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references users(id),
  action         varchar(50) not null,
  entity_type    varchar(50) not null,
  entity_id      uuid,
  old_data       jsonb,
  new_data       jsonb,
  created_at     timestamptz not null default now()
);

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  type         varchar(50) not null,
  title        varchar(150) not null,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_actor on audit_logs(actor_user_id);
create index idx_notifications_user on notifications(user_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Pola umum: admin (is_admin(auth.uid())) akses penuh; crew hanya akses
-- data miliknya sendiri untuk tabel personal (attendance, permissions,
-- overtimes, corrections, notifications). Tabel referensi/master (stores,
-- events, equipment_assets, dll) bisa dibaca semua user login, tapi
-- hanya admin yang bisa insert/update/delete.
-- =====================================================================

alter table users enable row level security;
create policy users_self_or_admin on users for select
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy users_update_self_or_admin on users for update
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy users_admin_write on users for insert
  with check (public.is_admin(auth.uid()));

alter table roles enable row level security;
create policy roles_read_all on roles for select using (auth.uid() is not null);

alter table user_roles enable row level security;
create policy user_roles_self_or_admin on user_roles for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy user_roles_admin_write on user_roles for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

alter table crew enable row level security;
create policy crew_self_or_admin on crew for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy crew_admin_write on crew for insert with check (public.is_admin(auth.uid()));
create policy crew_admin_update on crew for update using (public.is_admin(auth.uid()));

-- Tabel referensi: baca boleh semua yang login, tulis hanya admin
do $$
declare
  t text;
  reference_tables text[] := array[
    'stores', 'store_assignments', 'store_schedules',
    'events', 'event_locations', 'event_assignments', 'event_schedules',
    'equipment_assets', 'event_asset_assignments'
  ];
begin
  foreach t in array reference_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy %I_read_all on %I for select using (auth.uid() is not null);', t, t);
    execute format('create policy %I_admin_write on %I for insert with check (public.is_admin(auth.uid()));', t, t);
    execute format('create policy %I_admin_update on %I for update using (public.is_admin(auth.uid()));', t, t);
  end loop;
end $$;

-- Tabel personal crew: crew lihat & buat punya sendiri; admin lihat semua & approve
alter table attendance_logs enable row level security;
create policy attendance_self_or_admin_select on attendance_logs for select
  using (crew_id in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy attendance_self_insert on attendance_logs for insert
  with check (crew_id in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy attendance_admin_update on attendance_logs for update
  using (public.is_admin(auth.uid()));

alter table attendance_corrections enable row level security;
create policy corrections_self_or_admin_select on attendance_corrections for select
  using (crew_id in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy corrections_self_insert on attendance_corrections for insert
  with check (crew_id in (select id from crew where user_id = auth.uid()));
create policy corrections_admin_update on attendance_corrections for update
  using (public.is_admin(auth.uid()));

alter table permissions enable row level security;
create policy permissions_self_or_admin_select on permissions for select
  using (crew_id in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy permissions_self_insert on permissions for insert
  with check (crew_id in (select id from crew where user_id = auth.uid()));
create policy permissions_admin_update on permissions for update
  using (public.is_admin(auth.uid()));

alter table overtimes enable row level security;
create policy overtimes_self_or_admin_select on overtimes for select
  using (crew_id in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid()));
create policy overtimes_self_insert on overtimes for insert
  with check (crew_id in (select id from crew where user_id = auth.uid()));
create policy overtimes_admin_update on overtimes for update
  using (public.is_admin(auth.uid()));

alter table event_checklists enable row level security;
create policy checklists_read_all on event_checklists for select using (auth.uid() is not null);
create policy checklists_crew_or_admin_write on event_checklists for insert
  with check (
    signed_by in (select id from crew where user_id = auth.uid()) or public.is_admin(auth.uid())
  );

alter table inspection_reports enable row level security;
create policy inspection_reports_read_all on inspection_reports for select using (auth.uid() is not null);
create policy inspection_reports_admin_write on inspection_reports for insert
  with check (public.is_admin(auth.uid()));

alter table audit_logs enable row level security;
create policy audit_logs_admin_only on audit_logs for select using (public.is_admin(auth.uid()));
create policy audit_logs_insert_all on audit_logs for insert with check (auth.uid() is not null);

alter table notifications enable row level security;
create policy notifications_self_only on notifications for select using (user_id = auth.uid());
create policy notifications_self_update on notifications for update using (user_id = auth.uid());
