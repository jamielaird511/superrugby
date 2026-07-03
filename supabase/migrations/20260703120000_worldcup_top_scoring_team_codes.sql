-- Allow multiple joint top group-stage scoring teams in official competition results.

ALTER TABLE public.worldcup_competition_results
  ADD COLUMN IF NOT EXISTS top_scoring_team_codes text[] NULL;

UPDATE public.worldcup_competition_results
SET top_scoring_team_codes = ARRAY[trim(top_scoring_team_code)]
WHERE top_scoring_team_code IS NOT NULL
  AND trim(top_scoring_team_code) <> ''
  AND (
    top_scoring_team_codes IS NULL
    OR cardinality(top_scoring_team_codes) = 0
  );
