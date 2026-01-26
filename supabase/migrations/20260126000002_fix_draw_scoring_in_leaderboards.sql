-- Fix DRAW scoring in leaderboard views to award 24 points for correct DRAW picks

-- Update leaderboard_overall_public view
CREATE OR REPLACE VIEW "public"."leaderboard_overall_public" AS
 SELECT "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    COALESCE("sum"(
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("r"."winning_team" = 'DRAW'::text) THEN
                CASE
                    WHEN ("pk"."picked_team" = 'DRAW'::text) THEN 24
                    ELSE 0
                END
            WHEN ("pk"."picked_team" <> "r"."winning_team") THEN 0
            ELSE (5 +
            CASE
                WHEN (("r"."margin_band" IS NOT NULL) AND ("pk"."margin" IS NOT NULL) AND ((("r"."margin_band" = '1-12'::text) AND ("pk"."margin" = 1)) OR (("r"."margin_band" = '13+'::text) AND ("pk"."margin" = 13)))) THEN 3
                ELSE 0
            END)
        END), (0)::bigint) AS "total_points"
   FROM (("public"."participants" "p"
     LEFT JOIN "public"."picks" "pk" ON (("pk"."participant_id" = "p"."id")))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "pk"."fixture_id")))
  WHERE ("p"."team_name" !~~* '%(admin)%'::text)
  GROUP BY "p"."id", "p"."team_name", "p"."category";

ALTER VIEW "public"."leaderboard_overall_public" OWNER TO postgres;

-- Update leaderboard_round_public view
CREATE OR REPLACE VIEW "public"."leaderboard_round_public" AS
 SELECT "f"."round_id",
    "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    COALESCE("sum"(
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("pk"."picked_team" IS NULL) THEN 0
            WHEN ("r"."winning_team" = 'DRAW'::text) THEN
                CASE
                    WHEN ("pk"."picked_team" = 'DRAW'::text) THEN 24
                    ELSE 0
                END
            WHEN ("pk"."picked_team" <> "r"."winning_team") THEN 0
            ELSE (5 +
            CASE
                WHEN (("r"."margin_band" IS NOT NULL) AND ("pk"."margin" IS NOT NULL) AND ((("r"."margin_band" = '1-12'::text) AND ("pk"."margin" = 1)) OR (("r"."margin_band" = '13+'::text) AND ("pk"."margin" = 13)))) THEN 3
                ELSE 0
            END)
        END), (0)::bigint) AS "total_points"
   FROM ((("public"."participants" "p"
     JOIN "public"."fixtures" "f" ON (true))
     LEFT JOIN "public"."picks" "pk" ON ((("pk"."participant_id" = "p"."id") AND ("pk"."fixture_id" = "f"."id"))))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "f"."id")))
  WHERE ("p"."team_name" !~~* '%(admin)%'::text)
  GROUP BY "f"."round_id", "p"."id", "p"."team_name", "p"."category";

ALTER VIEW "public"."leaderboard_round_public" OWNER TO postgres;

-- Update v_pick_scores view (used by v_round_leaderboard)
CREATE OR REPLACE VIEW "public"."v_pick_scores" AS
 SELECT "p"."participant_id",
    "p"."fixture_id",
    "p"."picked_team",
    "p"."margin" AS "picked_margin_encoded",
    "r"."winning_team",
    "r"."margin_band" AS "actual_margin_band",
    CASE
        WHEN ("r"."winning_team" IS NULL) THEN 0
        WHEN ("r"."winning_team" = 'DRAW'::text) THEN
            CASE
                WHEN ("p"."picked_team" = 'DRAW'::text) THEN 24
                ELSE 0
            END
        WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
        ELSE 5
    END AS "winner_points",
    CASE
        WHEN ("r"."winning_team" IS NULL) THEN 0
        WHEN ("r"."winning_team" = 'DRAW'::text) THEN 0
        WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
        WHEN ("p"."picked_team" = 'DRAW'::text) THEN 0
        WHEN (
            CASE
                WHEN ("p"."margin" = 1) THEN '1-12'::text
                WHEN ("p"."margin" = 13) THEN '13+'::text
                ELSE NULL::text
            END = "r"."margin_band") THEN 3
        ELSE 0
    END AS "margin_points",
    (
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("r"."winning_team" = 'DRAW'::text) THEN
                CASE
                    WHEN ("p"."picked_team" = 'DRAW'::text) THEN 24
                    ELSE 0
                END
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            ELSE 5
        END +
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("r"."winning_team" = 'DRAW'::text) THEN 0
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            WHEN ("p"."picked_team" = 'DRAW'::text) THEN 0
            WHEN (
                CASE
                    WHEN ("p"."margin" = 1) THEN '1-12'::text
                    WHEN ("p"."margin" = 13) THEN '13+'::text
                    ELSE NULL::text
                END = "r"."margin_band") THEN 3
            ELSE 0
        END) AS "total_points"
   FROM ("public"."picks" "p"
     JOIN "public"."results" "r" ON (("r"."fixture_id" = "p"."fixture_id")));

ALTER VIEW "public"."v_pick_scores" OWNER TO postgres;
