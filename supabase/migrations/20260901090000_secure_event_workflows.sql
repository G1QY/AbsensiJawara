-- Workflow event hanya dibaca/ditulis melalui backend yang memverifikasi
-- bahwa akun Crew Event memiliki penugasan pada event tersebut.
alter table public.event_workflows enable row level security;
revoke all on table public.event_workflows from anon, authenticated;

drop policy if exists event_workflows_admin_read on public.event_workflows;

alter table public.event_workflows
  drop constraint if exists event_workflows_progress_order;
alter table public.event_workflows
  add constraint event_workflows_progress_order check (max_reached >= current_step);
