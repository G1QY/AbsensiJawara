-- =====================================================================
-- 003_attendance.sql — FotoSnaps DB
-- Satu engine attendance untuk Crew Store maupun Crew Event.
--
-- Crew Store : Crew -> Store Assignment -> Store Schedule -> Attendance
-- Crew Event : Crew -> Event Assignment -> Event Schedule -> Attendance
--
-- store_schedule_id & event_schedule_id dibuat EKSPLISIT (bukan satu
-- kolom generik) supaya foreign key valid & tidak polymorphic.
-- =====================================================================

create table attendance_logs (
  id                     uuid primary key default gen_random_uuid(),
  crew_id                uuid not null references crew(id) on delete cascade,
  store_assignment_id    uuid references store_assignments(id),
  event_assignment_id    uuid references event_assignments(id),
  store_schedule_id      uuid references store_schedules(id),
  event_schedule_id      uuid references event_schedules(id),
  attendance_date        date not null,
  check_in               timestamptz,
  check_in_lat           numeric(10, 7),
  check_in_lng           numeric(10, 7),
  check_in_distance_m    numeric(6, 2),
  check_in_photo_url     text,
  check_out              timestamptz,
  check_out_lat          numeric(10, 7),
  check_out_lng          numeric(10, 7),
  check_out_distance_m   numeric(6, 2),
  check_out_photo_url    text,
  status                 varchar(20) not null default 'ON_TIME'
                         check (status in ('ON_TIME', 'LATE', 'ABSENT', 'PENDING')),
  late_minutes           integer not null default 0,
  created_at             timestamptz not null default now(),
  constraint chk_one_context check (
    (store_assignment_id is not null and event_assignment_id is null)
    or (store_assignment_id is null and event_assignment_id is not null)
  ),
  constraint chk_schedule_matches_context check (
    (store_assignment_id is not null and event_schedule_id is null)
    or (event_assignment_id is not null and store_schedule_id is null)
  ),
  constraint chk_checkout_after_checkin check (check_out is null or check_out > check_in)
);

create table attendance_corrections (
  id                   uuid primary key default gen_random_uuid(),
  attendance_id        uuid not null references attendance_logs(id) on delete cascade,
  crew_id              uuid not null references crew(id) on delete cascade,
  requested_check_in   timestamptz,
  requested_check_out  timestamptz,
  reason               text not null,
  attachment_url       text,
  status               varchar(20) not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by          uuid references users(id),
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now()
);

create table permissions (
  id             uuid primary key default gen_random_uuid(),
  crew_id        uuid not null references crew(id) on delete cascade,
  start_date     date not null,
  end_date       date not null,
  type           varchar(30) not null check (type in ('SICK', 'LEAVE', 'PERMIT', 'OTHER')),
  reason         text,
  attachment_url text,
  status         varchar(20) not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at     timestamptz not null default now()
);

create table overtimes (
  id               uuid primary key default gen_random_uuid(),
  crew_id          uuid not null references crew(id) on delete cascade,
  attendance_id    uuid references attendance_logs(id),
  start_time       timestamptz not null,
  end_time         timestamptz,
  duration_minutes integer,
  reason           text,
  status           varchar(20) not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       timestamptz not null default now()
);

create index idx_attendance_crew_date on attendance_logs(crew_id, attendance_date);
create index idx_attendance_store_assignment on attendance_logs(store_assignment_id);
create index idx_attendance_event_assignment on attendance_logs(event_assignment_id);
create index idx_corrections_attendance on attendance_corrections(attendance_id);
create index idx_permissions_crew on permissions(crew_id);
create index idx_overtimes_crew on overtimes(crew_id);
