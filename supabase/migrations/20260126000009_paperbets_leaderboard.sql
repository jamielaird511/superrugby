-- RPC: paperbets_leaderboard(p_round_id uuid default null)
-- Returns one row per participant with bets_count, wins_count, total_staked, total_return, profit, roi.
-- Only includes settled bets (fixture has a result). Won logic matches v_paper_leaderboard.

create or replace function public.paperbets_leaderboard(p_round_id uuid default null)
returns table (
  participant_id uuid,
  team_name text,
  bets_count int,
  wins_count int,
  total_staked numeric,
  total_return numeric,
  profit numeric,
  roi numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with bets as (
    select
      pb.participant_id,
      coalesce(p.team_name, 'Unknown') as team_name,
      pb.stake::numeric as stake,
      pb.odds::numeric as odds,
      case
        when (pb.outcome = 'draw' and r.winning_team = 'DRAW')
          or (pb.outcome = 'home_1_12' and r.winning_team = f.home_team_code and r.margin_band = '1-12')
          or (pb.outcome = 'home_13_plus' and r.winning_team = f.home_team_code and r.margin_band = '13+')
          or (pb.outcome = 'away_1_12' and r.winning_team = f.away_team_code and r.margin_band = '1-12')
          or (pb.outcome = 'away_13_plus' and r.winning_team = f.away_team_code and r.margin_band = '13+')
        then true
        else false
      end as won
    from public.paper_bets pb
    join public.fixtures f on f.id = pb.fixture_id
    join public.results r on r.fixture_id = pb.fixture_id
    left join public.participants p on p.id = pb.participant_id
    where (p_round_id is null or f.round_id = p_round_id)
  )
  select
    b.participant_id,
    b.team_name,
    count(*)::int as bets_count,
    sum(case when b.won then 1 else 0 end)::int as wins_count,
    coalesce(sum(b.stake), 0)::numeric as total_staked,
    coalesce(sum(case when b.won then b.stake * b.odds else 0 end), 0)::numeric as total_return,
    (coalesce(sum(case when b.won then b.stake * b.odds else 0 end), 0) - coalesce(sum(b.stake), 0))::numeric as profit,
    case
      when coalesce(sum(b.stake), 0) = 0 then 0::numeric
      else (coalesce(sum(case when b.won then b.stake * b.odds else 0 end), 0) - coalesce(sum(b.stake), 0)) / nullif(sum(b.stake), 0)
    end as roi
  from bets b
  group by b.participant_id, b.team_name
  order by profit desc nulls last,
           roi desc nulls last,
           bets_count desc,
           b.team_name asc;
$$;

alter function public.paperbets_leaderboard(uuid) owner to postgres;
