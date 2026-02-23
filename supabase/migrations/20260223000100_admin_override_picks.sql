-- Admin override for locked picks (service_role only).
-- Adds audit fields and allows bypassing lockout trigger only for service_role requests.

-- 1) Add audit fields to picks
alter table public.picks
  add column if not exists admin_override boolean not null default false,
  add column if not exists admin_override_reason text,
  add column if not exists admin_overridden_at timestamptz;

-- Optional but strongly recommended: ensure one pick per participant+fixture+league
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'picks_participant_fixture_league_unique'
  ) then
    alter table public.picks
      add constraint picks_participant_fixture_league_unique
      unique (participant_id, fixture_id, league_id);
  end if;
end $$;

-- 2) Update lockout function to allow service_role bypass
create or replace function public.check_fixture_lockout_picks()
returns trigger
language plpgsql
as $$
declare
  kickoff timestamptz;
  jwt_role text;
begin
  -- Allow service_role to write after kickoff (admin override path).
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = 'service_role' then
    return new;
  end if;

  select f.kickoff_at
    into kickoff
  from public.fixtures f
  where f.id = new.fixture_id;

  if kickoff is null then
    return new;
  end if;

  if kickoff <= now() then
    raise exception 'Fixture is locked (kickoff has passed)';
  end if;

  return new;
end;
$$;

-- 3) Update second lockout function to allow service_role bypass
create or replace function public.enforce_fixture_lockout_on_picks()
returns trigger
language plpgsql
as $$
declare
  k timestamptz;
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role = 'service_role' then
    return new;
  end if;

  select kickoff_at into k
  from public.fixtures
  where id = new.fixture_id;

  if k is null then
    return new;
  end if;

  if now() >= k then
    raise exception 'Fixture is locked (kickoff has passed)';
  end if;

  return new;
end;
$$;
