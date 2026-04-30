-- Store full-time football scores on results; allow margin_band NULL when home_goals/away_goals are set.
-- Super Rugby rows keep home_goals/away_goals NULL and use margin bands as before.

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS home_goals smallint,
  ADD COLUMN IF NOT EXISTS away_goals smallint;

ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_draw_margin_null;
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_margin_band_valid;
ALTER TABLE public.results DROP CONSTRAINT IF EXISTS results_valid_winner_margin;

ALTER TABLE public.results ADD CONSTRAINT results_outcome_rugby_or_football CHECK (
  (
    margin_band IN ('1-12', '13+')
    AND winning_team <> 'DRAW'
    AND home_goals IS NULL
    AND away_goals IS NULL
  )
  OR
  (
    winning_team = 'DRAW'
    AND margin_band IS NULL
    AND home_goals IS NULL
    AND away_goals IS NULL
  )
  OR
  (
    margin_band IS NULL
    AND home_goals IS NOT NULL
    AND away_goals IS NOT NULL
  )
);
