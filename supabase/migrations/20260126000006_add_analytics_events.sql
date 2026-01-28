-- Add analytics_events table for tracking user events

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    event_name text NOT NULL,
    participant_id uuid NULL REFERENCES public.participants(id) ON DELETE SET NULL,
    metadata jsonb NULL,
    user_agent text NULL,
    ip text NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_created_at ON public.analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_participant_id_created_at ON public.analytics_events(participant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present (avoids conflicts on re-run)
DROP POLICY IF EXISTS "Block authenticated inserts" ON public.analytics_events;
DROP POLICY IF EXISTS "Block authenticated selects" ON public.analytics_events;

-- Block all direct access for public role; only service role (bypasses RLS) can insert/select via API
CREATE POLICY "Block direct inserts"
    ON public.analytics_events
    FOR INSERT
    TO public
    WITH CHECK (false);
CREATE POLICY "Block direct selects"
    ON public.analytics_events
    FOR SELECT
    TO public
    USING (false);
