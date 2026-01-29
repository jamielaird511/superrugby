-- Add match_odds table for TAB Winning Margin odds

CREATE TABLE IF NOT EXISTS public.match_odds (
    fixture_id uuid PRIMARY KEY REFERENCES public.fixtures(id) ON DELETE CASCADE,
    draw_odds numeric NOT NULL,
    home_1_12_odds numeric NOT NULL,
    home_13_plus_odds numeric NOT NULL,
    away_1_12_odds numeric NOT NULL,
    away_13_plus_odds numeric NOT NULL,
    odds_as_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT match_odds_draw_odds_check CHECK (draw_odds >= 1.01),
    CONSTRAINT match_odds_home_1_12_odds_check CHECK (home_1_12_odds >= 1.01),
    CONSTRAINT match_odds_home_13_plus_odds_check CHECK (home_13_plus_odds >= 1.01),
    CONSTRAINT match_odds_away_1_12_odds_check CHECK (away_1_12_odds >= 1.01),
    CONSTRAINT match_odds_away_13_plus_odds_check CHECK (away_13_plus_odds >= 1.01)
);

-- Create trigger to update updated_at on row update
CREATE TRIGGER match_odds_updated_at
    BEFORE UPDATE ON public.match_odds
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.match_odds ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for authenticated users (read-only)
CREATE POLICY "Allow authenticated selects"
    ON public.match_odds
    FOR SELECT
    TO authenticated
    USING (true);

-- Block INSERT/UPDATE for authenticated users (admin-only via API)
CREATE POLICY "Block authenticated inserts"
    ON public.match_odds
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "Block authenticated updates"
    ON public.match_odds
    FOR UPDATE
    TO authenticated
    USING (false);
