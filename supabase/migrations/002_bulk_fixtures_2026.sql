-- Bulk upsert fixtures for Season 2026 (Rounds 1-16)
-- Optional: Uncomment the DELETE below to wipe season 2026 fixtures before reload
-- DELETE FROM fixtures WHERE round_id IN (SELECT id FROM rounds WHERE season = 2026);

-- Note: This assumes rounds for season 2026 already exist in the rounds table
-- You'll need to replace the round_id values below with actual round IDs from your database
-- Format: (round_id, match_number, kickoff_at, home_team_code, away_team_code)

INSERT INTO fixtures (round_id, match_number, kickoff_at, home_team_code, away_team_code)
VALUES
  -- Round 1 fixtures (replace 'round_1_id' with actual round ID)
  -- ('round_1_id', 1, '2026-02-14 19:05:00+13', 'BLU', 'CHI'),
  -- ('round_1_id', 2, '2026-02-14 19:35:00+13', 'CRU', 'MOA'),
  -- ... (add all Round 1 fixtures)
  
  -- Round 2 fixtures
  -- ('round_2_id', 1, '2026-02-21 19:05:00+13', 'HUR', 'BLU'),
  -- ... (add all Round 2 fixtures)
  
  -- Continue for Rounds 3-16...
  
  -- Example structure (uncomment and replace with actual data):
  -- ('round_id_here', 1, '2026-02-14 19:05:00+13', 'BLU', 'CHI'),
  -- ('round_id_here', 2, '2026-02-15 19:35:00+13', 'CRU', 'MOA'),
  -- ... (77 fixtures total)
ON CONFLICT (round_id, match_number) 
DO UPDATE SET
  kickoff_at = EXCLUDED.kickoff_at,
  home_team_code = EXCLUDED.home_team_code,
  away_team_code = EXCLUDED.away_team_code;
