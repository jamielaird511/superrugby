-- Add multi-league support using league_id and league_code

-- Create leagues table
CREATE TABLE IF NOT EXISTS public.leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_code text NOT NULL UNIQUE,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leagues_pkey PRIMARY KEY (id)
);

ALTER TABLE public.leagues OWNER TO postgres;

-- Create default league for existing data (ANZ2026)
INSERT INTO public.leagues (league_code, name)
VALUES ('ANZ2026', 'ANZ Super Rugby 2026')
ON CONFLICT (league_code) DO NOTHING;

-- Get the default league ID (will be used for backfill)
DO $$
DECLARE
    default_league_id uuid;
BEGIN
    SELECT id INTO default_league_id FROM public.leagues WHERE league_code = 'ANZ2026' LIMIT 1;
    
    -- Add league_id to participants
    ALTER TABLE public.participants
        ADD COLUMN IF NOT EXISTS league_id uuid;
    
    ALTER TABLE public.participants
        ADD CONSTRAINT participants_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE RESTRICT;
    
    -- Backfill existing participants
    UPDATE public.participants
    SET league_id = default_league_id
    WHERE league_id IS NULL;
    
    -- Make league_id NOT NULL after backfill
    ALTER TABLE public.participants
        ALTER COLUMN league_id SET NOT NULL;
    
    -- Add league_id to rounds
    ALTER TABLE public.rounds
        ADD COLUMN IF NOT EXISTS league_id uuid;
    
    ALTER TABLE public.rounds
        ADD CONSTRAINT rounds_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE RESTRICT;
    
    -- Backfill existing rounds
    UPDATE public.rounds
    SET league_id = default_league_id
    WHERE league_id IS NULL;
    
    -- Make league_id NOT NULL after backfill
    ALTER TABLE public.rounds
        ALTER COLUMN league_id SET NOT NULL;
    
    -- Add league_id to fixtures (via rounds relationship, but store directly for performance)
    ALTER TABLE public.fixtures
        ADD COLUMN IF NOT EXISTS league_id uuid;
    
    ALTER TABLE public.fixtures
        ADD CONSTRAINT fixtures_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE RESTRICT;
    
    -- Backfill existing fixtures via their rounds
    UPDATE public.fixtures f
    SET league_id = r.league_id
    FROM public.rounds r
    WHERE f.round_id = r.id AND f.league_id IS NULL;
    
    -- Make league_id NOT NULL after backfill
    ALTER TABLE public.fixtures
        ALTER COLUMN league_id SET NOT NULL;
    
    -- Add league_id to picks (via participant relationship, but store directly for performance)
    ALTER TABLE public.picks
        ADD COLUMN IF NOT EXISTS league_id uuid;
    
    ALTER TABLE public.picks
        ADD CONSTRAINT picks_league_id_fkey
        FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE RESTRICT;
    
    -- Backfill existing picks via their participants
    UPDATE public.picks pk
    SET league_id = p.league_id
    FROM public.participants p
    WHERE pk.participant_id = p.id AND pk.league_id IS NULL;
    
    -- Make league_id NOT NULL after backfill
    ALTER TABLE public.picks
        ALTER COLUMN league_id SET NOT NULL;
END $$;

-- Create index on league_code for fast lookups
CREATE INDEX IF NOT EXISTS leagues_league_code_idx ON public.leagues(league_code);

-- Create indexes on league_id columns for filtering
CREATE INDEX IF NOT EXISTS participants_league_id_idx ON public.participants(league_id);
CREATE INDEX IF NOT EXISTS rounds_league_id_idx ON public.rounds(league_id);
CREATE INDEX IF NOT EXISTS fixtures_league_id_idx ON public.fixtures(league_id);
CREATE INDEX IF NOT EXISTS picks_league_id_idx ON public.picks(league_id);
