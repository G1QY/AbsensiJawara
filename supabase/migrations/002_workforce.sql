-- =====================================================================
-- 002_workforce.sql — FotoSnaps DB
-- Store (untuk Crew Store) & Event (untuk Crew Event) beserta assignment/schedule.
-- FotoSnaps mendukung dua tipe crew, jadi Store dan Event sama-sama tersedia.
-- =====================================================================

-- ---------------------------------------------------------------------
-- stores & store assignment/schedule
-- Alur: Crew Store -> Store -> Store Assignment -> Store Schedule
-- ---------------------------------------------------------------------
create table stores (
  id             uuid primary key default gen_random_uuid(),
  code           varchar(30) not null unique,
  name           varchar(150) not null,
  address        text,
  latitude       numeric(10, 7) not null,
  longitude      numeric(10, 7) not null,
  radius_meters  integer not null default 50,
  status         varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at     timestamptz not null default now()
);

create table store_assignments (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references crew(id) on delete cascade,
  store_id     uuid not null references stores(id) on delete cascade,
  start_date   date not null,
  end_date     date,
  status       varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED')),
  created_at   timestamptz not null default now()
);

create table store_schedules (
  id                        uuid primary key default gen_random_uuid(),
  store_assignment_id       uuid not null references store_assignments(id) on delete cascade,
  schedule_date             date not null,
  start_time                time not null,
  end_time                  time not null,
  late_tolerance_minutes    integer not null default 0,
  created_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- events & event location/assignment/schedule
-- Alur: Crew Event -> Event -> Event Assignment -> Event Schedule
-- ---------------------------------------------------------------------
create table events (
  id           uuid primary key default gen_random_uuid(),
  event_code   varchar(30) not null unique,
  event_name   varchar(150) not null,
  client_name  varchar(150),
  event_date   date not null,
  status       varchar(20) not null default 'SCHEDULED'
               check (status in ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  created_at   timestamptz not null default now()
);

create table event_locations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  address        text,
  latitude       numeric(10, 7) not null,
  longitude      numeric(10, 7) not null,
  radius_meters  integer not null default 50
);

create table event_assignments (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references events(id) on delete cascade,
  crew_id      uuid not null references crew(id) on delete cascade,
  position     varchar(50),
  status       varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED'))
);

create table event_schedules (
  id                     uuid primary key default gen_random_uuid(),
  event_assignment_id    uuid not null references event_assignments(id) on delete cascade,
  schedule_date          date not null,
  start_time             time not null,
  end_time               time not null,
  status                 varchar(20) not null default 'ACTIVE'
);

create index idx_store_assignments_crew on store_assignments(crew_id);
create index idx_store_assignments_store on store_assignments(store_id);
create index idx_store_schedules_assignment on store_schedules(store_assignment_id);
create index idx_event_assignments_crew on event_assignments(crew_id);
create index idx_event_assignments_event on event_assignments(event_id);
create index idx_event_schedules_assignment on event_schedules(event_assignment_id);
