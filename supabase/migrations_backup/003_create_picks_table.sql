-- Create picks table for participant fixture picks
CREATE TABLE IF NOT EXISTS public.picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  fixture_id uuid NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  picked_team_code text NOT NULL,
  picked_margin integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id, fixture_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_picks_participant_id ON public.picks(participant_id);
CREATE INDEX IF NOT EXISTS idx_picks_fixture_id ON public.picks(fixture_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_picks_updated_at
  BEFORE UPDATE ON public.picks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
