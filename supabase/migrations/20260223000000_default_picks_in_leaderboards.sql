-- Apply default picks (home team 1–12) when a participant has no pick for a fixture.
-- IMPORTANT:
-- - No DB writes to picks. Defaults are virtual at scoring time.
-- - Submitted picks always override defaults.
-- - Draw scoring remains: only a DRAW pick scores 24 on a DRAW result.

-- 1) OVERALL LEADERBOARD
DROP VIEW IF EXISTS "public"."leaderboard_overall_public";

CREATE VIEW "public"."leaderboard_overall_public" AS
SELECT
  p.id AS participant_id,
  p.team_name,
  p.category,
  p.league_id,
  COALESCE(
    SUM(
      CASE
        WHEN r.winning_team IS NULL THEN 0

        -- DRAW at full time: only scores if you picked DRAW.
        WHEN r.winning_team = 'DRAW'::text THEN
          CASE
            WHEN COALESCE(pk.picked_team, f.home_team_code) = 'DRAW'::text THEN 24
            ELSE 0
          END

        -- Wrong winner
        WHEN COALESCE(pk.picked_team, f.home_team_code) <> r.winning_team THEN 0

        -- Correct winner: 5 points + margin bonus if correct band
        ELSE (
          5 +
          CASE
            WHEN (
              r.margin_band IS NOT NULL
              AND (
                (r.margin_band = '1-12'::text AND COALESCE(pk.margin, 1) = 1)
                OR
                (r.margin_band = '13+'::text AND COALESCE(pk.margin, 1) = 13)
              )
            ) THEN 3
            ELSE 0
          END
        )
      END
    ),
    0::bigint
  ) AS total_points
FROM "public"."participants" p
JOIN "public"."fixtures" f
  ON f.league_id = p.league_id
LEFT JOIN "public"."picks" pk
  ON pk.participant_id = p.id
  AND pk.fixture_id = f.id
  AND pk.league_id = p.league_id
LEFT JOIN "public"."results" r
  ON r.fixture_id = f.id
WHERE p.team_name !~~* '%(admin)%'::text
GROUP BY p.id, p.team_name, p.category, p.league_id;

ALTER VIEW "public"."leaderboard_overall_public" OWNER TO postgres;

GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "service_role";


-- 2) ROUND LEADERBOARD
DROP VIEW IF EXISTS "public"."leaderboard_round_public";

CREATE VIEW "public"."leaderboard_round_public" AS
SELECT
  f.round_id,
  p.id AS participant_id,
  p.team_name,
  p.category,
  p.league_id,
  COALESCE(
    SUM(
      CASE
        WHEN r.winning_team IS NULL THEN 0

        -- DRAW at full time: only scores if you picked DRAW.
        WHEN r.winning_team = 'DRAW'::text THEN
          CASE
            WHEN COALESCE(pk.picked_team, f.home_team_code) = 'DRAW'::text THEN 24
            ELSE 0
          END

        -- Wrong winner
        WHEN COALESCE(pk.picked_team, f.home_team_code) <> r.winning_team THEN 0

        -- Correct winner: 5 points + margin bonus if correct band
        ELSE (
          5 +
          CASE
            WHEN (
              r.margin_band IS NOT NULL
              AND (
                (r.margin_band = '1-12'::text AND COALESCE(pk.margin, 1) = 1)
                OR
                (r.margin_band = '13+'::text AND COALESCE(pk.margin, 1) = 13)
              )
            ) THEN 3
            ELSE 0
          END
        )
      END
    ),
    0::bigint
  ) AS total_points
FROM "public"."participants" p
JOIN "public"."fixtures" f
  ON f.league_id = p.league_id
LEFT JOIN "public"."picks" pk
  ON pk.participant_id = p.id
  AND pk.fixture_id = f.id
  AND pk.league_id = p.league_id
LEFT JOIN "public"."results" r
  ON r.fixture_id = f.id
WHERE p.team_name !~~* '%(admin)%'::text
GROUP BY f.round_id, p.id, p.team_name, p.category, p.league_id;

ALTER VIEW "public"."leaderboard_round_public" OWNER TO postgres;

GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "service_role";
