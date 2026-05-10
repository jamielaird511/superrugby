create table if not exists public.worldcup_competition_picks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  winner_team_code text null,
  semifinalist_team_codes text[] null,
  group_picks jsonb not null default '{}'::jsonb,
  total_goals integer null,
  top_scoring_team_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, competition_id)
);

drop trigger if exists set_worldcup_competition_picks_updated_at on public.worldcup_competition_picks;
create trigger set_worldcup_competition_picks_updated_at
before update on public.worldcup_competition_picks
for each row
execute function public.set_updated_at();
