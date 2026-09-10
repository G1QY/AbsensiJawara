-- Memperluas progress workflow Crew Event dari 14 menjadi 15 langkah.
-- Data JSON lama tetap dipertahankan. Workflow yang belum selesai dimulai
-- kembali dari langkah pertama agar mengikuti urutan operasional baru.

begin;

alter table public.event_workflows
  drop constraint if exists event_workflows_current_step_check,
  drop constraint if exists event_workflows_max_reached_check,
  drop constraint if exists event_workflows_progress_order;

update public.event_workflows
set current_step = case when max_reached >= 14 then 15 else 1 end,
    max_reached = case when max_reached >= 14 then 15 else 1 end,
    updated_at = now();

alter table public.event_workflows
  add constraint event_workflows_current_step_check check (current_step between 1 and 15),
  add constraint event_workflows_max_reached_check check (max_reached between 1 and 15),
  add constraint event_workflows_progress_order check (max_reached >= current_step);

commit;
