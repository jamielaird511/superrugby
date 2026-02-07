-- Paperpunter V1: paper_bets table and v_paper_leaderboard view

CREATE TABLE IF NOT EXISTS public.paper_bets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
    league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE RESTRICT,
    outcome text NOT NULL,
    stake numeric NOT NULL DEFAULT 10,
    odds numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT paper_bets_outcome_check CHECK (outcome IN (
        'home_1_12', 'home_13_plus', 'draw', 'away_1_12', 'away_13_plus'
    )),
    CONSTRAINT paper_bets_stake_positive CHECK (stake > 0),
    CONSTRAINT paper_bets_odds_min CHECK (odds >= 1.01),
    CONSTRAINT paper_bets_participant_fixture_unique UNIQUE (participant_id, fixture_id)
);

ALTER TABLE public.paper_bets OWNER TO postgres;

CREATE INDEX IF NOT EXISTS paper_bets_participant_id_idx ON public.paper_bets(participant_id);
CREATE INDEX IF NOT EXISTS paper_bets_fixture_id_idx ON public.paper_bets(fixture_id);
CREATE INDEX IF NOT EXISTS paper_bets_league_id_idx ON public.paper_bets(league_id);

-- RLS: read own bets only (participant.auth_user_id = auth.uid()); INSERT/UPDATE/DELETE blocked for authenticated (service-role only)
ALTER TABLE public.paper_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own paper_bets only" ON public.paper_bets;
DROP POLICY IF EXISTS "Block authenticated inserts" ON public.paper_bets;
DROP POLICY IF EXISTS "Block authenticated updates" ON public.paper_bets;
DROP POLICY IF EXISTS "Block authenticated deletes" ON public.paper_bets;

CREATE POLICY "Read own paper_bets only"
    ON public.paper_bets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.participants p
            WHERE p.id = paper_bets.participant_id
              AND p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Block authenticated inserts"
    ON public.paper_bets
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "Block authenticated updates"
    ON public.paper_bets
    FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Block authenticated deletes"
    ON public.paper_bets
    FOR DELETE
    TO authenticated
    USING (false);

-- v_paper_leaderboard: one row per participant per league with total paper profit (settled bets only) one row per participant per league with total paper profit (settled bets only)
DROP VIEW IF EXISTS public.v_paper_leaderboard CASCADE;

CREATE VIEW public.v_paper_leaderboard AS
SELECT
    p.id AS participant_id,
    p.team_name,
    p.category,
    p.league_id,
    COALESCE(SUM(
        CASE
            WHEN r.winning_team IS NULL THEN 0
            WHEN (pb.outcome = 'draw' AND r.winning_team = 'DRAW')
                OR (pb.outcome = 'home_1_12' AND r.winning_team = f.home_team_code AND r.margin_band = '1-12')
                OR (pb.outcome = 'home_13_plus' AND r.winning_team = f.home_team_code AND r.margin_band = '13+')
                OR (pb.outcome = 'away_1_12' AND r.winning_team = f.away_team_code AND r.margin_band = '1-12')
                OR (pb.outcome = 'away_13_plus' AND r.winning_team = f.away_team_code AND r.margin_band = '13+')
            THEN (pb.stake * pb.odds) - pb.stake
            ELSE -pb.stake
        END
    ), 0)::numeric AS paper_profit
FROM public.participants p
LEFT JOIN public.paper_bets pb ON pb.participant_id = p.id AND pb.league_id = p.league_id
LEFT JOIN public.results r ON r.fixture_id = pb.fixture_id
LEFT JOIN public.fixtures f ON f.id = pb.fixture_id
WHERE p.team_name !~~* '%(admin)%'
GROUP BY p.id, p.team_name, p.category, p.league_id;

ALTER VIEW public.v_paper_leaderboard OWNER TO postgres;

GRANT SELECT ON TABLE public.v_paper_leaderboard TO authenticated;
GRANT SELECT ON TABLE public.v_paper_leaderboard TO service_role;
