-- Add competitions and make schedules competition-scoped

CREATE TABLE IF NOT EXISTS public.competitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_code text NOT NULL UNIQUE,
    name text NOT NULL,
    sport text,
    season int,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.competitions OWNER TO postgres;

-- Default competition for existing data
INSERT INTO public.competitions (competition_code, name, sport, season)
VALUES ('SR2026', 'Super Rugby 2026', 'super_rugby', 2026)
ON CONFLICT (competition_code) DO NOTHING;

DO $$
DECLARE
  comp_id uuid;
BEGIN
  SELECT id INTO comp_id FROM public.competitions WHERE competition_code = 'SR2026' LIMIT 1;

  -- leagues -> competition
  ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS competition_id uuid;
  ALTER TABLE public.leagues
    ADD CONSTRAINT leagues_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE RESTRICT;

  UPDATE public.leagues
    SET competition_id = comp_id
  WHERE competition_id IS NULL;

  ALTER TABLE public.leagues ALTER COLUMN competition_id SET NOT NULL;

  -- rounds -> competition
  ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS competition_id uuid;
  ALTER TABLE public.rounds
    ADD CONSTRAINT rounds_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE RESTRICT;

  UPDATE public.rounds
    SET competition_id = comp_id
  WHERE competition_id IS NULL;

  ALTER TABLE public.rounds ALTER COLUMN competition_id SET NOT NULL;

  -- fixtures -> competition
  ALTER TABLE public.fixtures ADD COLUMN IF NOT EXISTS competition_id uuid;
  ALTER TABLE public.fixtures
    ADD CONSTRAINT fixtures_competition_id_fkey
    FOREIGN KEY (competition_id) REFERENCES public.competitions(id) ON DELETE RESTRICT;

  UPDATE public.fixtures f
    SET competition_id = r.competition_id
  FROM public.rounds r
  WHERE f.round_id = r.id AND f.competition_id IS NULL;

  ALTER TABLE public.fixtures ALTER COLUMN competition_id SET NOT NULL;
END $$;

CREATE INDEX IF NOT EXISTS leagues_competition_id_idx ON public.leagues(competition_id);
CREATE INDEX IF NOT EXISTS rounds_competition_id_idx ON public.rounds(competition_id);
CREATE INDEX IF NOT EXISTS fixtures_competition_id_idx ON public.fixtures(competition_id);

