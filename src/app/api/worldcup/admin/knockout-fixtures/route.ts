import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";
import { FIFA_WORLD_CUP_2026_LEAGUE_ID } from "@/lib/worldCupIds";
import { getWorldCupCompetitionId } from "@/lib/worldCupScope";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GROUP_ROUND_MIN = 101;
const GROUP_ROUND_MAX = 199;

const PHASE_ORDER = [
  "Round of 32",
  "Round of 16",
  "Quarter-finals",
  "Semi-finals",
  "Third-place",
  "Final",
  "Knockout",
] as const;

function logWcKnockout(stage: string, payload: Record<string, unknown>) {
  console.error("[WC admin knockout-fixtures]", stage, JSON.stringify(payload));
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
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  const userEmailLower = user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmailLower)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

function isWorldCupKnockoutFixture(matchNumber: number, roundNumber: number): boolean {
  const inGroupRound = roundNumber >= GROUP_ROUND_MIN && roundNumber <= GROUP_ROUND_MAX;
  if (inGroupRound) return false;
  return matchNumber >= 73 || roundNumber >= 200;
}

function knockoutPhaseLabel(roundNumber: number, matchNumber: number): string {
  if (roundNumber >= 200) {
    const idx = Math.min(5, Math.max(0, Math.floor((roundNumber - 200) / 10)));
    return PHASE_ORDER[idx] ?? "Knockout";
  }
  if (matchNumber >= 125) return "Final";
  if (matchNumber >= 121) return "Third-place";
  if (matchNumber >= 113) return "Semi-finals";
  if (matchNumber >= 105) return "Quarter-finals";
  if (matchNumber >= 89) return "Round of 16";
  if (matchNumber >= 73) return "Round of 32";
  return "Knockout";
}

function phaseSortKey(phase: string): number {
  const i = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);
  return i === -1 ? PHASE_ORDER.length : i;
}

function normalizeTeamCodeInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s.toUpperCase() === "TBD") return null;
  return s.toUpperCase();
}

export async function GET(_req: NextRequest) {
  const auth = await requireAdmin(_req);
  if ("error" in auth) return auth.error;

  try {
    const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
    if (!wcCompId) {
      return NextResponse.json(
        { error: "World Cup competition could not be resolved" },
        { status: 500 }
      );
    }

    const currentSeason = new Date().getFullYear();

    const [{ data: rounds, error: roundsError }, { data: wcTeams, error: teamsError }] =
      await Promise.all([
        supabaseAdmin
          .from("rounds")
          .select("id, season, round_number")
          .eq("season", currentSeason)
          .eq("competition_id", wcCompId),
        supabaseAdmin.from("world_cup_teams").select("code, name").order("name", { ascending: true }),
      ]);

    if (teamsError) {
      logWcKnockout("world_cup_teams", { message: teamsError.message, code: teamsError.code });
      return NextResponse.json({ error: "Failed to load teams" }, { status: 500 });
    }

    const teams = (wcTeams || [])
      .map((t) => ({
        code: String(t.code || "").trim().toUpperCase(),
        name: String(t.name || t.code || "").trim(),
      }))
      .filter((t) => t.code);

    if (roundsError) {
      logWcKnockout("rounds", {
        message: roundsError.message,
        code: roundsError.code,
      });
      return NextResponse.json({ error: "Failed to load rounds" }, { status: 500 });
    }

    const roundRows = rounds || [];
    const roundById: Record<string, { season: number; round_number: number }> = {};
    for (const r of roundRows) {
      roundById[r.id as string] = {
        season: r.season as number,
        round_number: r.round_number as number,
      };
    }

    const roundIds = roundRows.map((r) => r.id as string).filter(Boolean);
    if (roundIds.length === 0) {
      return NextResponse.json({ sections: [], teams }, { status: 200 });
    }

    const { data: fixturesRaw, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
      .eq("competition_id", wcCompId)
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
      .in("round_id", roundIds)
      .order("kickoff_at", { ascending: true });

    if (fixturesError) {
      logWcKnockout("fixtures", {
        message: fixturesError.message,
        code: fixturesError.code,
      });
      return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
    }

    const knockoutRows: {
      id: string;
      match_number: number;
      home_team_code: string | null;
      away_team_code: string | null;
      kickoff_at: string | null;
      round_number: number;
      season: number;
      phase: string;
    }[] = [];

    for (const f of fixturesRaw || []) {
      const rid = f.round_id as string | undefined;
      const rn = rid ? roundById[rid]?.round_number ?? -1 : -1;
      const season = rid ? roundById[rid]?.season ?? currentSeason : currentSeason;
      const mn = Number(f.match_number);
      if (!Number.isFinite(mn)) continue;
      if (!isWorldCupKnockoutFixture(mn, rn)) continue;

      const phase = knockoutPhaseLabel(rn, mn);
      knockoutRows.push({
        id: f.id as string,
        match_number: mn,
        home_team_code: (f.home_team_code as string | null) ?? null,
        away_team_code: (f.away_team_code as string | null) ?? null,
        kickoff_at: (f.kickoff_at as string | null) ?? null,
        round_number: rn,
        season,
        phase,
      });
    }

    knockoutRows.sort((a, b) => {
      const pk = phaseSortKey(a.phase) - phaseSortKey(b.phase);
      if (pk !== 0) return pk;
      if (a.round_number !== b.round_number) return a.round_number - b.round_number;
      return a.match_number - b.match_number;
    });

    const sectionMap = new Map<string, typeof knockoutRows>();
    for (const row of knockoutRows) {
      if (!sectionMap.has(row.phase)) sectionMap.set(row.phase, []);
      sectionMap.get(row.phase)!.push(row);
    }

    const sections = [...sectionMap.entries()]
      .sort(([a], [b]) => phaseSortKey(a) - phaseSortKey(b))
      .map(([phase, fixtures]) => ({
        phase,
        fixtures: fixtures.map((fx) => ({
          id: fx.id,
          match_number: fx.match_number,
          phase,
          round_number: fx.round_number,
          kickoff_at: fx.kickoff_at,
          home_team_code: fx.home_team_code ? String(fx.home_team_code).trim().toUpperCase() : null,
          away_team_code: fx.away_team_code ? String(fx.away_team_code).trim().toUpperCase() : null,
        })),
      }));

    return NextResponse.json({ sections, teams }, { status: 200 });
  } catch (err) {
    logWcKnockout("exception", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const fixtureId = typeof body.fixtureId === "string" ? body.fixtureId.trim() : "";
  if (!fixtureId || !UUID_RE.test(fixtureId)) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  const homeTeamCode = normalizeTeamCodeInput(body.homeTeamCode);
  const awayTeamCode = normalizeTeamCodeInput(body.awayTeamCode);

  if (homeTeamCode && awayTeamCode && homeTeamCode === awayTeamCode) {
    return NextResponse.json({ error: "Home and away teams must differ" }, { status: 400 });
  }

  try {
    const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
    if (!wcCompId) {
      return NextResponse.json(
        { error: "World Cup competition could not be resolved" },
        { status: 500 }
      );
    }

    const { data: teamsRows, error: teamsErr } = await supabaseAdmin
      .from("world_cup_teams")
      .select("code");

    if (teamsErr || !teamsRows) {
      logWcKnockout("PATCH teams", { message: teamsErr?.message });
      return NextResponse.json({ error: "Failed to validate teams" }, { status: 500 });
    }

    const validCodes = new Set(
      teamsRows
        .map((t) => String(t.code || "").trim().toUpperCase())
        .filter(Boolean)
    );

    if (homeTeamCode && !validCodes.has(homeTeamCode)) {
      return NextResponse.json({ error: "Invalid team code" }, { status: 400 });
    }
    if (awayTeamCode && !validCodes.has(awayTeamCode)) {
      return NextResponse.json({ error: "Invalid team code" }, { status: 400 });
    }

    const { data: fixture, error: fxErr } = await supabaseAdmin
      .from("fixtures")
      .select("id, match_number, round_id, competition_id, league_id")
      .eq("id", fixtureId)
      .maybeSingle();

    if (fxErr || !fixture) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }

    if (
      fixture.competition_id !== wcCompId ||
      fixture.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID
    ) {
      return NextResponse.json({ error: "Fixture cannot be updated" }, { status: 403 });
    }

    const roundId = fixture.round_id as string;
    const { data: roundRow, error: roundErr } = await supabaseAdmin
      .from("rounds")
      .select("round_number")
      .eq("id", roundId)
      .maybeSingle();

    if (roundErr || roundRow == null) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }

    const roundNumber = Number(roundRow.round_number);
    const matchNumber = Number(fixture.match_number);
    if (!isWorldCupKnockoutFixture(matchNumber, roundNumber)) {
      return NextResponse.json({ error: "Fixture cannot be updated" }, { status: 400 });
    }

    const { error: upErr } = await supabaseAdmin
      .from("fixtures")
      .update({
        home_team_code: homeTeamCode,
        away_team_code: awayTeamCode,
      })
      .eq("id", fixtureId)
      .eq("competition_id", wcCompId)
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID);

    if (upErr) {
      logWcKnockout("PATCH update", { message: upErr.message, code: upErr.code });
      return NextResponse.json({ error: "Failed to save fixture" }, { status: 500 });
    }

    return NextResponse.json(
      {
        fixture: {
          id: fixtureId,
          home_team_code: homeTeamCode,
          away_team_code: awayTeamCode,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    logWcKnockout("PATCH exception", { message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
