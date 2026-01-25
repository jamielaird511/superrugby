


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_fixture_lockout_picks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  fixture_kickoff timestamptz;
begin
  select f.kickoff_at
    into fixture_kickoff
  from public.fixtures f
  where f.id = new.fixture_id;

  -- If fixture doesn't exist, fail loudly (data integrity issue)
  if fixture_kickoff is null then
    -- If kickoff_at is actually NULL we allow it; but if the fixture row didn't exist,
    -- fixture_kickoff will also be NULL. So we need to detect missing fixture:
    if not exists (select 1 from public.fixtures f where f.id = new.fixture_id) then
      raise exception 'Invalid fixture_id: %', new.fixture_id;
    end if;

    -- kickoff_at is NULL => unlocked
    return new;
  end if;

  if now() >= fixture_kickoff then
    raise exception 'Fixture is locked (kickoff has passed)';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_fixture_lockout_picks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_fixture_lockout_on_picks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  k timestamptz;
begin
  select kickoff_at into k
  from public.fixtures
  where id = new.fixture_id;

  -- If kickoff time isn't set yet, allow edits
  if k is null then
    return new;
  end if;

  if now() >= k then
    raise exception 'Fixture is locked (kickoff has passed)';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_fixture_lockout_on_picks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."fixtures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "round_id" "uuid" NOT NULL,
    "match_number" integer NOT NULL,
    "kickoff_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "home_team_code" "text",
    "away_team_code" "text",
    CONSTRAINT "fixtures_home_away_diff" CHECK (("home_team_code" <> "away_team_code")),
    CONSTRAINT "fixtures_match_number_positive" CHECK (("match_number" > 0))
);


ALTER TABLE "public"."fixtures" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fixtures"."kickoff_at" IS 'Kickoff time stored as timestamptz (UTC); UI displays in NZ time';



CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_name" "text",
    "team_name" "text",
    "category" "text",
    "password_hash" "text",
    "auth_email" "text",
    "auth_user_id" "uuid",
    CONSTRAINT "participants_category_check" CHECK (("category" = ANY (ARRAY['accountant'::"text", 'broker'::"text", 'financial_services'::"text", 'solicitor'::"text", 'valuer'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."picks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "picked_team" "text" NOT NULL,
    "margin" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "picks_margin_band_check" CHECK (((("picked_team" = 'DRAW'::"text") AND (("margin" IS NULL) OR ("margin" = 0))) OR (("picked_team" <> 'DRAW'::"text") AND ("margin" = ANY (ARRAY[1, 13])))))
);


ALTER TABLE "public"."picks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "winning_team" "text" NOT NULL,
    "actual_margin" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "margin_band" "text",
    CONSTRAINT "results_draw_margin_null" CHECK (((("winning_team" = 'DRAW'::"text") AND ("margin_band" IS NULL)) OR (("winning_team" <> 'DRAW'::"text") AND ("margin_band" = ANY (ARRAY['1-12'::"text", '13+'::"text"]))))),
    CONSTRAINT "results_margin_band_valid" CHECK ((("margin_band" = ANY (ARRAY['1-12'::"text", '13+'::"text"])) OR ("margin_band" IS NULL))),
    CONSTRAINT "results_valid_winner_margin" CHECK (((("winning_team" = 'DRAW'::"text") AND ("margin_band" IS NULL)) OR (("winning_team" <> 'DRAW'::"text") AND ("margin_band" = ANY (ARRAY['1-12'::"text", '13+'::"text"])))))
);


ALTER TABLE "public"."results" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_overall_public" AS
 SELECT "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    COALESCE("sum"(
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("pk"."picked_team" <> "r"."winning_team") THEN 0
            ELSE (5 +
            CASE
                WHEN (("pk"."picked_team" = 'DRAW'::"text") OR ("r"."winning_team" = 'DRAW'::"text")) THEN 0
                WHEN (("r"."margin_band" IS NOT NULL) AND ("pk"."margin" IS NOT NULL) AND ((("r"."margin_band" = '1-12'::"text") AND ("pk"."margin" = 1)) OR (("r"."margin_band" = '13+'::"text") AND ("pk"."margin" = 13)))) THEN 3
                ELSE 0
            END)
        END), (0)::bigint) AS "total_points"
   FROM (("public"."participants" "p"
     LEFT JOIN "public"."picks" "pk" ON (("pk"."participant_id" = "p"."id")))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "pk"."fixture_id")))
  WHERE ("p"."team_name" !~~* '%(admin)%'::"text")
  GROUP BY "p"."id", "p"."team_name", "p"."category";


ALTER VIEW "public"."leaderboard_overall_public" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_round_public" AS
 SELECT "f"."round_id",
    "p"."id" AS "participant_id",
    "p"."team_name",
    "p"."category",
    COALESCE("sum"(
        CASE
            WHEN ("r"."winning_team" IS NULL) THEN 0
            WHEN ("pk"."picked_team" IS NULL) THEN 0
            WHEN ("pk"."picked_team" <> "r"."winning_team") THEN 0
            ELSE (5 +
            CASE
                WHEN (("pk"."picked_team" = 'DRAW'::"text") OR ("r"."winning_team" = 'DRAW'::"text")) THEN 0
                WHEN (("r"."margin_band" IS NOT NULL) AND ("pk"."margin" IS NOT NULL) AND ((("r"."margin_band" = '1-12'::"text") AND ("pk"."margin" = 1)) OR (("r"."margin_band" = '13+'::"text") AND ("pk"."margin" = 13)))) THEN 3
                ELSE 0
            END)
        END), (0)::bigint) AS "total_points"
   FROM ((("public"."participants" "p"
     JOIN "public"."fixtures" "f" ON (true))
     LEFT JOIN "public"."picks" "pk" ON ((("pk"."participant_id" = "p"."id") AND ("pk"."fixture_id" = "f"."id"))))
     LEFT JOIN "public"."results" "r" ON (("r"."fixture_id" = "f"."id")))
  WHERE ("p"."team_name" !~~* '%(admin)%'::"text")
  GROUP BY "f"."round_id", "p"."id", "p"."team_name", "p"."category";


ALTER VIEW "public"."leaderboard_round_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participant_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "wants_reminders" boolean DEFAULT true NOT NULL,
    "wants_results" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."participant_contacts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."participants_public" AS
 SELECT "id",
    "team_name",
    "category"
   FROM "public"."participants";


ALTER VIEW "public"."participants_public" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pick_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "fixture_id" "uuid" NOT NULL,
    "picked_team" "text" NOT NULL,
    "margin" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    CONSTRAINT "pick_events_margin_nonnegative" CHECK (("margin" >= 0))
);


ALTER TABLE "public"."pick_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rounds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season" integer DEFAULT (EXTRACT(year FROM "now"()))::integer NOT NULL,
    "round_number" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rounds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."super_rugby_teams" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "logo_path" "text"
);


ALTER TABLE "public"."super_rugby_teams" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pick_scores" AS
 SELECT "p"."participant_id",
    "p"."fixture_id",
    "p"."picked_team",
    "p"."margin" AS "picked_margin_encoded",
    "r"."winning_team",
    "r"."margin_band" AS "actual_margin_band",
        CASE
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            ELSE 5
        END AS "winner_points",
        CASE
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            WHEN ("p"."picked_team" = 'DRAW'::"text") THEN 0
            WHEN (
            CASE
                WHEN ("p"."margin" = 1) THEN '1-12'::"text"
                WHEN ("p"."margin" = 13) THEN '13+'::"text"
                ELSE NULL::"text"
            END = "r"."margin_band") THEN 3
            ELSE 0
        END AS "margin_points",
    (
        CASE
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            ELSE 5
        END +
        CASE
            WHEN ("p"."picked_team" <> "r"."winning_team") THEN 0
            WHEN ("p"."picked_team" = 'DRAW'::"text") THEN 0
            WHEN (
            CASE
                WHEN ("p"."margin" = 1) THEN '1-12'::"text"
                WHEN ("p"."margin" = 13) THEN '13+'::"text"
                ELSE NULL::"text"
            END = "r"."margin_band") THEN 3
            ELSE 0
        END) AS "total_points"
   FROM ("public"."picks" "p"
     JOIN "public"."results" "r" ON (("r"."fixture_id" = "p"."fixture_id")));


ALTER VIEW "public"."v_pick_scores" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_round_leaderboard" AS
 WITH "rounds_in_play" AS (
         SELECT DISTINCT "fixtures"."round_id"
           FROM "public"."fixtures"
          WHERE ("fixtures"."round_id" IS NOT NULL)
        )
 SELECT "r"."round_id",
    "par"."id" AS "participant_id",
    "par"."team_name",
    "par"."business_name",
    COALESCE("sum"("s"."total_points"), (0)::bigint) AS "round_points"
   FROM ((("rounds_in_play" "r"
     CROSS JOIN "public"."participants" "par")
     LEFT JOIN "public"."fixtures" "f" ON (("f"."round_id" = "r"."round_id")))
     LEFT JOIN "public"."v_pick_scores" "s" ON ((("s"."fixture_id" = "f"."id") AND ("s"."participant_id" = "par"."id"))))
  GROUP BY "r"."round_id", "par"."id", "par"."team_name", "par"."business_name";


ALTER VIEW "public"."v_round_leaderboard" OWNER TO "postgres";


ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_round_id_match_number_key" UNIQUE ("round_id", "match_number");



ALTER TABLE ONLY "public"."participant_contacts"
    ADD CONSTRAINT "participant_contacts_participant_id_email_key" UNIQUE ("participant_id", "email");



ALTER TABLE ONLY "public"."participant_contacts"
    ADD CONSTRAINT "participant_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_auth_email_key" UNIQUE ("auth_email");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pick_events"
    ADD CONSTRAINT "pick_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_participant_id_fixture_id_key" UNIQUE ("participant_id", "fixture_id");



ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_fixture_id_key" UNIQUE ("fixture_id");



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rounds"
    ADD CONSTRAINT "rounds_season_round_number_key" UNIQUE ("season", "round_number");



ALTER TABLE ONLY "public"."super_rugby_teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("code");



CREATE INDEX "pick_events_fixture_created_at_idx" ON "public"."pick_events" USING "btree" ("fixture_id", "created_at" DESC);



CREATE INDEX "pick_events_participant_created_at_idx" ON "public"."pick_events" USING "btree" ("participant_id", "created_at" DESC);



CREATE INDEX "pick_events_participant_fixture_created_at_idx" ON "public"."pick_events" USING "btree" ("participant_id", "fixture_id", "created_at" DESC);



CREATE UNIQUE INDEX "super_rugby_teams_code_uq" ON "public"."super_rugby_teams" USING "btree" ("code");



CREATE OR REPLACE TRIGGER "prevent_picks_after_kickoff" BEFORE INSERT OR UPDATE ON "public"."picks" FOR EACH ROW EXECUTE FUNCTION "public"."check_fixture_lockout_picks"();



CREATE OR REPLACE TRIGGER "set_picks_updated_at" BEFORE UPDATE ON "public"."picks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_picks_fixture_lockout" BEFORE INSERT OR UPDATE ON "public"."picks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_fixture_lockout_on_picks"();



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_away_team_code_fk" FOREIGN KEY ("away_team_code") REFERENCES "public"."super_rugby_teams"("code");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_home_team_code_fk" FOREIGN KEY ("home_team_code") REFERENCES "public"."super_rugby_teams"("code");



ALTER TABLE ONLY "public"."fixtures"
    ADD CONSTRAINT "fixtures_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."participant_contacts"
    ADD CONSTRAINT "participant_contacts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pick_events"
    ADD CONSTRAINT "pick_events_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pick_events"
    ADD CONSTRAINT "pick_events_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pick_events"
    ADD CONSTRAINT "pick_events_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."picks"
    ADD CONSTRAINT "picks_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."results"
    ADD CONSTRAINT "results_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "public"."fixtures"("id") ON DELETE CASCADE;



ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "participants_select_own" ON "public"."participants" FOR SELECT USING (("auth_user_id" = "auth"."uid"()));



ALTER TABLE "public"."picks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "picks_insert_own_before_kickoff" ON "public"."picks" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."participants" "p"
  WHERE (("p"."id" = "picks"."participant_id") AND ("p"."auth_user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."fixtures" "f"
  WHERE (("f"."id" = "picks"."fixture_id") AND ("now"() < "f"."kickoff_at"))))));



CREATE POLICY "picks_select_own" ON "public"."picks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."participants" "p"
  WHERE (("p"."id" = "picks"."participant_id") AND ("p"."auth_user_id" = "auth"."uid"())))));



CREATE POLICY "picks_update_own_before_kickoff" ON "public"."picks" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."participants" "p"
  WHERE (("p"."id" = "picks"."participant_id") AND ("p"."auth_user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."fixtures" "f"
  WHERE (("f"."id" = "picks"."fixture_id") AND ("now"() < "f"."kickoff_at")))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."participants" "p"
  WHERE (("p"."id" = "picks"."participant_id") AND ("p"."auth_user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."fixtures" "f"
  WHERE (("f"."id" = "picks"."fixture_id") AND ("now"() < "f"."kickoff_at"))))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_fixture_lockout_picks"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_fixture_lockout_picks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_fixture_lockout_picks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_fixture_lockout_on_picks"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_fixture_lockout_on_picks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_fixture_lockout_on_picks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."fixtures" TO "authenticated";
GRANT ALL ON TABLE "public"."fixtures" TO "service_role";



GRANT ALL ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";



GRANT ALL ON TABLE "public"."picks" TO "anon";
GRANT ALL ON TABLE "public"."picks" TO "authenticated";
GRANT ALL ON TABLE "public"."picks" TO "service_role";



GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_overall_public" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_round_public" TO "service_role";



GRANT ALL ON TABLE "public"."participant_contacts" TO "anon";
GRANT ALL ON TABLE "public"."participant_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."participant_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."participants_public" TO "anon";
GRANT ALL ON TABLE "public"."participants_public" TO "authenticated";
GRANT ALL ON TABLE "public"."participants_public" TO "service_role";



GRANT ALL ON TABLE "public"."pick_events" TO "anon";
GRANT ALL ON TABLE "public"."pick_events" TO "authenticated";
GRANT ALL ON TABLE "public"."pick_events" TO "service_role";



GRANT ALL ON TABLE "public"."rounds" TO "anon";
GRANT ALL ON TABLE "public"."rounds" TO "authenticated";
GRANT ALL ON TABLE "public"."rounds" TO "service_role";



GRANT ALL ON TABLE "public"."super_rugby_teams" TO "anon";
GRANT ALL ON TABLE "public"."super_rugby_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."super_rugby_teams" TO "service_role";



GRANT ALL ON TABLE "public"."v_pick_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."v_pick_scores" TO "service_role";



GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_round_leaderboard" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

revoke delete on table "public"."fixtures" from "anon";

revoke insert on table "public"."fixtures" from "anon";

revoke references on table "public"."fixtures" from "anon";

revoke select on table "public"."fixtures" from "anon";

revoke trigger on table "public"."fixtures" from "anon";

revoke truncate on table "public"."fixtures" from "anon";

revoke update on table "public"."fixtures" from "anon";

revoke delete on table "public"."participants" from "anon";

revoke insert on table "public"."participants" from "anon";

revoke references on table "public"."participants" from "anon";

revoke select on table "public"."participants" from "anon";

revoke trigger on table "public"."participants" from "anon";

revoke truncate on table "public"."participants" from "anon";

revoke update on table "public"."participants" from "anon";

revoke delete on table "public"."results" from "anon";

revoke insert on table "public"."results" from "anon";

revoke references on table "public"."results" from "anon";

revoke select on table "public"."results" from "anon";

revoke trigger on table "public"."results" from "anon";

revoke truncate on table "public"."results" from "anon";

revoke update on table "public"."results" from "anon";


