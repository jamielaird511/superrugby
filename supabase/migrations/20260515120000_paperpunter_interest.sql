-- PaperPunter "register interest" submissions (viewed via World Cup admin API; no direct client DB access).

CREATE TABLE IF NOT EXISTS public.paperpunter_interest (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    competition_idea text,
    created_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'new',
    CONSTRAINT paperpunter_interest_status_check CHECK (
        status = ANY (ARRAY['new'::text, 'contacted'::text, 'archived'::text])
    )
);

CREATE INDEX IF NOT EXISTS paperpunter_interest_created_at_idx ON public.paperpunter_interest (created_at DESC);

COMMENT ON TABLE public.paperpunter_interest IS 'PaperPunter create-competition interest form; inserts via service role API only.';

ALTER TABLE public.paperpunter_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paperpunter_interest_block_public_inserts" ON public.paperpunter_interest;
DROP POLICY IF EXISTS "paperpunter_interest_block_public_selects" ON public.paperpunter_interest;
DROP POLICY IF EXISTS "paperpunter_interest_block_public_updates" ON public.paperpunter_interest;

CREATE POLICY "paperpunter_interest_block_public_inserts"
    ON public.paperpunter_interest
    FOR INSERT
    TO public
    WITH CHECK (false);

CREATE POLICY "paperpunter_interest_block_public_selects"
    ON public.paperpunter_interest
    FOR SELECT
    TO public
    USING (false);

CREATE POLICY "paperpunter_interest_block_public_updates"
    ON public.paperpunter_interest
    FOR UPDATE
    TO public
    USING (false);
