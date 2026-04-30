import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FIFA_WORLD_CUP_2026_COMPETITION_ID,
  FIFA_WORLD_CUP_2026_LEAGUE_ID,
} from "@/lib/worldCupIds";

function roundLabel(season: number, roundNumber: number): string {
  if (roundNumber >= 101 && roundNumber <= 199) {
    return `Group Stage – Matchday ${roundNumber - 100}`;
  }
  return `Season ${season} · Round ${roundNumber}`;
}

export async function GET() {
  try {
    const currentSeason = new Date().getFullYear();

    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from("rounds")
      .select("id, season, round_number")
      .eq("season", currentSeason)
      .eq("competition_id", FIFA_WORLD_CUP_2026_COMPETITION_ID)
      .order("round_number", { ascending: true });

    if (roundsError) {
      console.error("World Cup results rounds:", roundsError);
      return NextResponse.json({ error: "Failed to load rounds" }, { status: 500 });
    }

    if (!rounds?.length) {
      return NextResponse.json({ rounds: [], teamNames: {} }, { status: 200 });
    }

    const roundIds = rounds.map((r) => r.id);

    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
      .eq("competition_id", FIFA_WORLD_CUP_2026_COMPETITION_ID)
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
      .in("round_id", roundIds)
      .order("kickoff_at", { ascending: true });

    if (fixturesError) {
      console.error("World Cup results fixtures:", fixturesError);
      return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
    }

    const fixtureList = fixtures || [];
    const fixtureIds = fixtureList.map((f) => f.id);

    if (fixtureIds.length === 0) {
      return NextResponse.json({ rounds: [], teamNames: {} }, { status: 200 });
    }

    const { data: resultsRows, error: resultsError } = await supabaseAdmin
      .from("results")
      .select("fixture_id, winning_team, home_goals, away_goals")
      .in("fixture_id", fixtureIds);

    if (resultsError) {
      console.error("World Cup results results:", resultsError);
      return NextResponse.json({ error: "Failed to load results" }, { status: 500 });
    }

    const resultByFixture: Record<
      string,
      {
        winning_team: string;
        home_goals: number | null;
        away_goals: number | null;
      }
    > = {};
    for (const row of resultsRows || []) {
      resultByFixture[row.fixture_id] = {
        winning_team: row.winning_team,
        home_goals: row.home_goals ?? null,
        away_goals: row.away_goals ?? null,
      };
    }

    const fixturesWithResults = fixtureList.filter((f) => {
      const res = resultByFixture[f.id];
      return !!res && res.home_goals != null && res.away_goals != null;
    });

    const byRound: Record<string, typeof fixturesWithResults> = {};
    for (const f of fixturesWithResults) {
      if (!byRound[f.round_id]) byRound[f.round_id] = [];
      byRound[f.round_id].push(f);
    }

    const { data: wcTeams, error: wcTeamsError } = await supabaseAdmin
      .from("world_cup_teams")
      .select("code, name");

    const teamNames: Record<string, string> = {};
    if (!wcTeamsError && wcTeams) {
      for (const t of wcTeams) {
        const c = t.code?.trim();
        if (c) teamNames[c.toUpperCase()] = t.name?.trim() || c;
      }
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
          winning_team: res.winning_team,
          home_goals: res.home_goals,
          away_goals: res.away_goals,
        };
      }),
    }));

    const roundsFiltered = roundsPayload.filter((section) => section.fixtures.length > 0);

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name")
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID);

    if (participantsError) {
      console.error("World Cup results participants:", participantsError);
      return NextResponse.json(
        { error: "Failed to load leaderboard participants" },
        { status: 500 }
      );
    }

    const leaderboardRows: { participant_id: string; team_name: string; points: number }[] =
      (participants || []).map((p) => ({
        participant_id: p.id,
        team_name: p.team_name ?? "Unknown",
        points: 0,
      }));

    const participantIds = leaderboardRows.map((p) => p.participant_id);
    const completedFixtureIds = fixturesWithResults.map((f) => f.id);

    if (participantIds.length > 0 && completedFixtureIds.length > 0) {
      const { data: picksRows, error: picksError } = await supabaseAdmin
        .from("picks")
        .select("participant_id, fixture_id, picked_team")
        .in("participant_id", participantIds)
        .in("fixture_id", completedFixtureIds);

      if (picksError) {
        console.error("World Cup results leaderboard picks:", picksError);
        return NextResponse.json(
          { error: "Failed to load leaderboard picks" },
          { status: 500 }
        );
      }

      const pointsByParticipant = new Map<string, number>();
      for (const p of leaderboardRows) pointsByParticipant.set(p.participant_id, 0);

      for (const pick of picksRows || []) {
        const fixtureResult = resultByFixture[pick.fixture_id];
        if (!fixtureResult) continue;
        if (pick.picked_team === fixtureResult.winning_team) {
          pointsByParticipant.set(
            pick.participant_id,
            (pointsByParticipant.get(pick.participant_id) || 0) + 1
          );
        }
      }

      for (const row of leaderboardRows) {
        row.points = pointsByParticipant.get(row.participant_id) || 0;
      }
    }

    leaderboardRows.sort((a, b) => b.points - a.points || a.team_name.localeCompare(b.team_name));

    return NextResponse.json(
      { rounds: roundsFiltered, teamNames, leaderboard: leaderboardRows },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup results route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
