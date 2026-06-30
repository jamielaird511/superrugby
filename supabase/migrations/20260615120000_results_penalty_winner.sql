-- Knockout football matches may finish level after extra time and be decided on penalties.
-- Full-time score stays in home_goals/away_goals; penalty_winner_team_code records the shootout winner.

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS penalty_winner_team_code text;
