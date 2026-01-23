-- Trigger function to prevent picks after fixture kickoff
CREATE OR REPLACE FUNCTION check_fixture_lockout_picks()
RETURNS TRIGGER AS $$
DECLARE
  fixture_kickoff timestamptz;
BEGIN
  -- Get the kickoff time for this fixture
  SELECT kickoff_at INTO fixture_kickoff
  FROM fixtures
  WHERE id = NEW.fixture_id;

  -- If kickoff_at is null, allow the operation
  IF fixture_kickoff IS NULL THEN
    RETURN NEW;
  END IF;

  -- If kickoff has passed, raise an exception
  IF NOW() >= fixture_kickoff THEN
    RAISE EXCEPTION 'Fixture is locked (kickoff has passed)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on picks table (only if picks table exists)
-- Run this manually if picks table exists:
-- CREATE TRIGGER prevent_picks_after_kickoff
--   BEFORE INSERT OR UPDATE ON picks
--   FOR EACH ROW
--   EXECUTE FUNCTION check_fixture_lockout_picks();
