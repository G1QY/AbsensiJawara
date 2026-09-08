-- Persistensi data workflow event lintas perangkat.
create table event_workflows (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null unique references events(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  current_step integer not null default 1 check (current_step between 1 and 14),
  max_reached  integer not null default 1 check (max_reached between 1 and 14),
  updated_by   uuid references users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_event_workflows_event on event_workflows(event_id);