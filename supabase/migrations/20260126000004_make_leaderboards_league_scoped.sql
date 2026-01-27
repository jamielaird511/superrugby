-- Make leaderboards league-scoped to prevent cross-league teams

-- Update leaderboard_overall_public view to include league_id and filter by it
DROP VIEW IF EXISTS "public"."leaderboard_overall_public";

CREATE VIEW "public"."leaderboard_overall_public" AS
 SELECT "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    "p"."league_id",
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
     LEFT JOIN "public"."picks" "pk" ON ((("pk"."participant_id" = "p"."id") AND ("pk"."league_id" = "p"."league_id")))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "pk"."fixture_id"))))
  WHERE (("p"."team_name" !~~* '%(admin)%'::text))
  GROUP BY "p"."id", "p"."team_name", "p"."category", "p"."league_id";

ALTER VIEW "public"."leaderboard_overall_public" OWNER TO postgres;

GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "service_role";

-- Update leaderboard_round_public view to include league_id and filter by it
DROP VIEW IF EXISTS "public"."leaderboard_round_public";

CREATE VIEW "public"."leaderboard_round_public" AS
 SELECT "f"."round_id",
    "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    "p"."league_id",
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
     JOIN "public"."fixtures" "f" ON (("f"."league_id" = "p"."league_id")))
     LEFT JOIN "public"."picks" "pk" ON ((("pk"."participant_id" = "p"."id") AND ("pk"."fixture_id" = "f"."id") AND ("pk"."league_id" = "p"."league_id"))))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "f"."id")))
  WHERE ("p"."team_name" !~~* '%(admin)%'::text)
  GROUP BY "f"."round_id", "p"."id", "p"."team_name", "p"."category", "p"."league_id";

ALTER VIEW "public"."leaderboard_round_public" OWNER TO postgres;

GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "service_role";

-- Update v_round_leaderboard view to include league_id and filter by it
DROP VIEW IF EXISTS "public"."v_round_leaderboard";

CREATE VIEW "public"."v_round_leaderboard" AS
 WITH "rounds_in_play" AS (
         SELECT DISTINCT "fixtures"."round_id", "fixtures"."league_id"
           FROM "public"."fixtures"
          WHERE ("fixtures"."round_id" IS NOT NULL)
        )
 SELECT "r"."round_id",
    "par"."id" AS "participant_id",
    "par"."team_name",
    "par"."business_name",
    "par"."league_id",
    COALESCE("sum"("s"."total_points"), (0)::bigint) AS "round_points"
   FROM ((("rounds_in_play" "r"
     CROSS JOIN "public"."participants" "par")
     LEFT JOIN "public"."fixtures" "f" ON ((("f"."round_id" = "r"."round_id") AND ("f"."league_id" = "r"."league_id"))))
     LEFT JOIN "public"."v_pick_scores" "s" ON ((("s"."fixture_id" = "f"."id") AND ("s"."participant_id" = "par"."id"))))
  WHERE ("par"."league_id" = "r"."league_id")
  GROUP BY "r"."round_id", "par"."id", "par"."team_name", "par"."business_name", "par"."league_id";

ALTER VIEW "public"."v_round_leaderboard" OWNER TO postgres;

GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "service_role";

GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "service_role";
