import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";
import { FIFA_WORLD_CUP_2026_LEAGUE_ID } from "@/lib/worldCupIds";
import { getWorldCupCompetitionId } from "@/lib/worldCupScope";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function logWcAdminGet(stage: string, payload: Record<string, unknown>) {
  console.error("[WC admin GET]", stage, JSON.stringify(payload, null, 2));
}

function roundLabel(season: number, roundNumber: number): string {
  if (roundNumber >= 101 && roundNumber <= 199) {
    return `Group Stage – Matchday ${roundNumber - 100}`;
  }
  return `Season ${season} · Round ${roundNumber}`;
}

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ||
    [];
  const userEmailLower = user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmailLower)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
    if (!wcCompId) {
      logWcAdminGet("getWorldCupCompetitionId", { result: null });
      return NextResponse.json(
        { error: "World Cup competition could not be resolved" },
        { status: 500 }
      );
    }

    const currentSeason = new Date().getFullYear();

    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from("rounds")
      .select("id, season, round_number")
      .eq("season", currentSeason)
      .eq("competition_id", wcCompId)
      .order("round_number", { ascending: true });

    if (roundsError) {
      logWcAdminGet("rounds", {
        message: roundsError.message,
        code: roundsError.code,
        details: roundsError.details,
        hint: roundsError.hint,
      });
      return NextResponse.json(
        { error: roundsError.message || "Failed to load rounds" },
        { status: 500 }
      );
    }

    if (!rounds?.length) {
      return NextResponse.json({ rounds: [], teamNames: {} }, { status: 200 });
    }

    const roundIds = rounds.map((r) => r.id);

    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select(
        "id, match_number, home_team_code, away_team_code, kickoff_at, round_id, competition_id, league_id"
      )
      .eq("competition_id", wcCompId)
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
      .in("round_id", roundIds)
      .order("kickoff_at", { ascending: true });

    if (fixturesError) {
      logWcAdminGet("fixtures", {
        message: fixturesError.message,
        code: fixturesError.code,
        details: fixturesError.details,
        hint: fixturesError.hint,
      });
      return NextResponse.json(
        { error: fixturesError.message || "Failed to load fixtures" },
        { status: 500 }
      );
    }

    const fixtureList = fixtures || [];
    const fixtureIds = fixtureList.map((f) => f.id);

    /** DB columns are home_goals/away_goals; JSON exposes home_score/away_score. */
    const resultByFixture: Record<
      string,
      {
        winning_team: string;
        margin_band: string | null;
        home_score: number | null;
        away_score: number | null;
      }
    > = {};

    if (fixtureIds.length > 0) {
      let resultsRows: {
        fixture_id: string;
        winning_team: string;
        margin_band: string | null;
        home_goals?: number | null;
        away_goals?: number | null;
      }[] | null = null;

      const withGoals = await supabaseAdmin
        .from("results")
        .select("fixture_id, winning_team, margin_band, home_goals, away_goals")
        .in("fixture_id", fixtureIds);

      if (withGoals.error) {
        logWcAdminGet("results_with_goals", {
          message: withGoals.error.message,
          code: withGoals.error.code,
          details: withGoals.error.details,
          hint: withGoals.error.hint,
        });
        const minimal = await supabaseAdmin
          .from("results")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds);

        if (minimal.error) {
          logWcAdminGet("results_minimal", {
            message: minimal.error.message,
            code: minimal.error.code,
            details: minimal.error.details,
            hint: minimal.error.hint,
          });
          return NextResponse.json(
            { error: minimal.error.message || "Failed to load results" },
            { status: 500 }
          );
        }
        resultsRows = minimal.data;
        for (const row of resultsRows || []) {
          resultByFixture[row.fixture_id] = {
            winning_team: row.winning_team,
            margin_band: row.margin_band,
            home_score: null,
            away_score: null,
          };
        }
      } else {
        resultsRows = withGoals.data;
        for (const row of resultsRows || []) {
          resultByFixture[row.fixture_id] = {
            winning_team: row.winning_team,
            margin_band: row.margin_band,
            home_score: row.home_goals ?? null,
            away_score: row.away_goals ?? null,
          };
        }
      }
    }

    const { data: wcTeams, error: wcTeamsError } = await supabaseAdmin
      .from("world_cup_teams")
      .select("code, name");

    if (wcTeamsError) {
      logWcAdminGet("world_cup_teams", {
        message: wcTeamsError.message,
        code: wcTeamsError.code,
      });
    }

    const teamNames: Record<string, string> = {};
    if (!wcTeamsError && wcTeams) {
      for (const t of wcTeams) {
        const c = t.code?.trim();
        if (c) teamNames[c.toUpperCase()] = t.name?.trim() || c;
      }
    }

    const byRound: Record<string, typeof fixtureList> = {};
    for (const f of fixtureList) {
      if (!byRound[f.round_id]) byRound[f.round_id] = [];
      byRound[f.round_id].push(f);
    }

    const roundsPayload = rounds.map((r) => ({
      id: r.id,
      label: roundLabel(r.season, r.round_number),
      season: r.season,
      round_number: r.round_number,
      fixtures: (byRound[r.id] || []).map((f) => {
        const res = resultByFixture[f.id];
        return {
          id: f.id,
          match_number: f.match_number,
          home_team_code: f.home_team_code,
          away_team_code: f.away_team_code,
          kickoff_at: f.kickoff_at,
          winning_team: res?.winning_team ?? null,
          margin_band: res?.margin_band ?? null,
          home_score: res?.home_score ?? null,
          away_score: res?.away_score ?? null,
        };
      }),
    }));

    return NextResponse.json({ rounds: roundsPayload, teamNames }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logWcAdminGet("exception", { message: msg });
    return NextResponse.json(
      { error: msg || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
    if (!wcCompId) {
      return NextResponse.json(
        { error: "World Cup competition could not be resolved" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const fixtureId = body?.fixture_id as string | undefined;
    const homeScoreRaw = body?.home_score ?? body?.home_goals;
    const awayScoreRaw = body?.away_score ?? body?.away_goals;

    if (!fixtureId || !UUID_RE.test(fixtureId)) {
      return NextResponse.json({ error: "fixture_id is required" }, { status: 400 });
    }

    const hg =
      typeof homeScoreRaw === "number"
        ? homeScoreRaw
        : typeof homeScoreRaw === "string"
          ? parseInt(homeScoreRaw, 10)
          : NaN;
    const ag =
      typeof awayScoreRaw === "number"
        ? awayScoreRaw
        : typeof awayScoreRaw === "string"
          ? parseInt(awayScoreRaw, 10)
          : NaN;

    if (!Number.isFinite(hg) || !Number.isFinite(ag)) {
      return NextResponse.json(
        { error: "home_score and away_score must be numbers" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(hg) || !Number.isInteger(ag)) {
      return NextResponse.json(
        { error: "Scores must be whole goals" },
        { status: 400 }
      );
    }
    if (hg < 0 || ag < 0 || hg > 50 || ag > 50) {
      return NextResponse.json({ error: "Scores out of range" }, { status: 400 });
    }

    const { data: fixture, error: fxErr } = await supabaseAdmin
      .from("fixtures")
      .select("id, home_team_code, away_team_code, competition_id, league_id")
      .eq("id", fixtureId)
      .single();

    if (fxErr || !fixture) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }

    if (
      fixture.competition_id !== wcCompId ||
      fixture.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID
    ) {
      return NextResponse.json({ error: "Fixture is not a World Cup match" }, { status: 403 });
    }

    const homeCode = String(fixture.home_team_code ?? "").trim();
    const awayCode = String(fixture.away_team_code ?? "").trim();
    if (!homeCode || !awayCode) {
      return NextResponse.json({ error: "Fixture teams missing" }, { status: 400 });
    }

    let winning_team: string;
    if (hg > ag) winning_team = homeCode;
    else if (ag > hg) winning_team = awayCode;
    else winning_team = "DRAW";

    const row = {
      fixture_id: fixtureId,
      winning_team,
      margin_band: null as string | null,
      actual_margin: null as number | null,
      home_goals: hg,
      away_goals: ag,
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upErr } = await supabaseAdmin
      .from("results")
      .upsert(row, { onConflict: "fixture_id" })
      .select("fixture_id, winning_team, margin_band, home_goals, away_goals")
      .single();

    if (upErr) {
      console.error("WC admin results upsert:", upErr);
      return NextResponse.json(
        { error: upErr.message || "Failed to save result" },
        { status: 500 }
      );
    }

    const payload = upserted as {
      fixture_id: string;
      winning_team: string;
      margin_band: string | null;
      home_goals: number | null;
      away_goals: number | null;
    };

    return NextResponse.json(
      {
        result: {
          fixture_id: payload.fixture_id,
          winning_team: payload.winning_team,
          margin_band: payload.margin_band,
          home_score: payload.home_goals ?? null,
          away_score: payload.away_goals ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("WC admin results POST:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
    if (!wcCompId) {
      return NextResponse.json(
        { error: "World Cup competition could not be resolved" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const fixtureId = searchParams.get("fixture_id")?.trim() ?? "";

    if (!fixtureId || !UUID_RE.test(fixtureId)) {
      return NextResponse.json({ error: "fixture_id is required" }, { status: 400 });
    }

    const { data: fixture, error: fxErr } = await supabaseAdmin
      .from("fixtures")
      .select("id, competition_id, league_id")
      .eq("id", fixtureId)
      .single();

    if (fxErr || !fixture) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }

    if (
      fixture.competition_id !== wcCompId ||
      fixture.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID
    ) {
      return NextResponse.json({ error: "Fixture is not a World Cup match" }, { status: 403 });
    }

    const scored = await supabaseAdmin
      .from("results")
      .select("fixture_id, home_goals, away_goals")
      .eq("fixture_id", fixtureId)
      .maybeSingle();

    if (scored.error) {
      logWcAdminGet("DELETE_results_read", {
        message: scored.error.message,
        code: scored.error.code,
      });
      return NextResponse.json(
        { error: scored.error.message || "Failed to read result" },
        { status: 500 }
      );
    }

    if (!scored.data) {
      return NextResponse.json({ error: "No result to clear" }, { status: 404 });
    }

    if (scored.data.home_goals == null || scored.data.away_goals == null) {
      return NextResponse.json({ error: "No saved scores to clear" }, { status: 400 });
    }

    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("results")
      .delete()
      .eq("fixture_id", fixtureId)
      .select("fixture_id");

    if (delErr) {
      console.error("WC admin results DELETE:", delErr);
      return NextResponse.json(
        { error: delErr.message || "Failed to clear result" },
        { status: 500 }
      );
    }

    if (!deleted?.length) {
      return NextResponse.json({ error: "No result to clear" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, fixture_id: fixtureId }, { status: 200 });
  } catch (err) {
    console.error("WC admin results DELETE:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
