-- Already executed in Supabase? No need to execute this again.
-- Re-running preserves existing codes and ballots.
create table if not exists public.workshop_votes (
  participant_id smallint primary key check (participant_id between 1 and 11),
  vote_token uuid not null unique default gen_random_uuid(),
  choice text check (choice in ('brunch', 'pizza')),
  updated_at timestamptz not null default now()
);
alter table public.workshop_votes enable row level security;
revoke all on public.workshop_votes from public, anon, authenticated;
grant usage on schema public to service_role;
grant select, update on public.workshop_votes to service_role;
insert into public.workshop_votes (participant_id)
select generate_series(1, 11)
on conflict (participant_id) do nothing;
select count(*) as participant_count from public.workshop_votes;
