-- =====================================================================
-- 004_equipment.sql — FotoSnaps DB (khusus, tidak dipakai Bujangan Food)
-- Alur: Equipment -> Event Assignment -> Pre-Event Checklist -> Event
--       -> Post-Event Checklist -> Inspection Report
-- =====================================================================

create table equipment_assets (
  id                 uuid primary key default gen_random_uuid(),
  asset_code         varchar(30) not null unique,
  serial_number      varchar(60),
  asset_type         varchar(50) not null,
  current_condition  varchar(30) not null default 'GOOD' check (current_condition in ('GOOD', 'MINOR_DAMAGE', 'DAMAGED', 'LOST')),
  status             varchar(20) not null default 'AVAILABLE' check (status in ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED')),
  created_at         timestamptz not null default now()
);

create table event_asset_assignments (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  asset_id         uuid not null references equipment_assets(id) on delete cascade,
  assigned_at      timestamptz not null default now(),
  returned_at      timestamptz,
  return_condition varchar(30) check (return_condition in ('GOOD', 'MINOR_DAMAGE', 'DAMAGED', 'LOST'))
);

create table event_checklists (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  asset_id      uuid not null references equipment_assets(id) on delete cascade,
  phase         varchar(20) not null check (phase in ('PRE_EVENT', 'POST_EVENT')),
  is_present    boolean not null default true,
  damage_notes  text,
  photo_url     text,
  signed_by     uuid references crew(id),
  signed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table inspection_reports (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  report_number  varchar(40) not null unique,
  pdf_url        text,
  generated_at   timestamptz,
  status         varchar(20) not null default 'PENDING' check (status in ('PENDING', 'GENERATED', 'FAILED')),
  created_at     timestamptz not null default now()
);

create index idx_event_asset_assignments_event on event_asset_assignments(event_id);
create index idx_event_checklists_event on event_checklists(event_id);
create index idx_inspection_reports_event on inspection_reports(event_id);
