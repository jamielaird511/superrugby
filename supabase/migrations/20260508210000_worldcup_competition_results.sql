create table if not exists public.worldcup_competition_results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique references public.competitions(id) on delete cascade,
  winner_team_code text null,
  semifinalist_team_codes text[] null,
  group_results jsonb not null default '{}'::jsonb,
  total_goals integer null,
  top_scoring_team_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_worldcup_competition_results_updated_at on public.worldcup_competition_results;
create trigger set_worldcup_competition_results_updated_at
before update on public.worldcup_competition_results
for each row
execute function public.set_updated_at();
