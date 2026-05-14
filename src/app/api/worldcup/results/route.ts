import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantFromRequest } from "@/lib/worldCupRequestTenant";
import {
  accumulatePoolPlayGoalsScored,
  computeTotalGoalsPointsByParticipant,
  scorePoolFinishingPositions,
  scorePoolTopAttackingPick,
  scoreSemiFinalistSlots,
  scoreWinnerPick,
  sumBreakdown,
  topPoolPlayScoringTeamCodes,
  WC_MATCH_PICK_POINTS,
} from "@/lib/worldCupScoring";

function roundLabel(season: number, roundNumber: number): string {
  if (roundNumber >= 101 && roundNumber <= 199) {
    return `Group Stage – Matchday ${roundNumber - 100}`;
  }
  return `Season ${season} · Round ${roundNumber}`;
}

export type WorldCupResultsLeaderboardBreakdown = {
  match_picks: number;
  pool_positions: number;
  semifinalists: number;
  pool_top_attacking: number;
  total_goals: number;
  winner: number;
  total: number;
};

export async function GET(req: Request) {
  try {
    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const currentSeason = new Date().getFullYear();

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

    const { data: rounds, error: roundsError } = await supabaseAdmin
      .from("rounds")
      .select("id, season, round_number")
      .eq("season", currentSeason)
      .eq("competition_id", tenant.competitionId)
      .order("round_number", { ascending: true });

    if (roundsError) {
      console.error("World Cup results rounds:", roundsError);
      return NextResponse.json({ error: "Failed to load rounds" }, { status: 500 });
    }

    const roundList = rounds || [];
    const roundIds = roundList.map((r) => r.id);

    const roundNumberByRoundId: Record<string, number> = {};
    for (const r of roundList) {
      roundNumberByRoundId[r.id] = r.round_number;
    }

    let fixtureList: Array<{
      id: string;
      match_number: number;
      home_team_code: string;
      away_team_code: string;
      kickoff_at: string | null;
      round_id: string;
    }> = [];

    if (roundIds.length > 0) {
      const { data: fixtures, error: fixturesError } = await supabaseAdmin
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("competition_id", tenant.competitionId)
        .eq("league_id", tenant.leagueId)
        .in("round_id", roundIds)
        .order("kickoff_at", { ascending: true });

      if (fixturesError) {
        console.error("World Cup results fixtures:", fixturesError);
        return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
      }
      fixtureList = fixtures || [];
    }

    const resultByFixture: Record<
      string,
      {
        winning_team: string;
        home_goals: number | null;
        away_goals: number | null;
      }
    > = {};

    const fixtureIds = fixtureList.map((f) => f.id);
    if (fixtureIds.length > 0) {
      const { data: resultsRows, error: resultsError } = await supabaseAdmin
        .from("results")
        .select("fixture_id, winning_team, home_goals, away_goals")
        .in("fixture_id", fixtureIds);

      if (resultsError) {
        console.error("World Cup results results:", resultsError);
        return NextResponse.json({ error: "Failed to load results" }, { status: 500 });
      }

      for (const row of resultsRows || []) {
        resultByFixture[row.fixture_id] = {
          winning_team: row.winning_team,
          home_goals: row.home_goals ?? null,
          away_goals: row.away_goals ?? null,
        };
      }
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

    const roundsPayload = roundList.map((r) => ({
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

    const poolGoalsByTeam = accumulatePoolPlayGoalsScored(fixtureList, roundNumberByRoundId, resultByFixture);
    const topPoolAttackingCodes = topPoolPlayScoringTeamCodes(poolGoalsByTeam);

    const { data: compResultRow } = await supabaseAdmin
      .from("worldcup_competition_results")
      .select("winner_team_code, semifinalist_team_codes, group_results, total_goals")
      .eq("competition_id", tenant.competitionId)
      .maybeSingle();

    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name")
      .eq("league_id", tenant.leagueId);

    if (participantsError) {
      console.error("World Cup results participants:", participantsError);
      return NextResponse.json(
        { error: "Failed to load leaderboard participants" },
        { status: 500 }
      );
    }

    const leaderboardRows: {
      participant_id: string;
      team_name: string;
      points: number;
      breakdown: WorldCupResultsLeaderboardBreakdown;
    }[] = (participants || []).map((p) => ({
      participant_id: p.id,
      team_name: p.team_name ?? "Unknown",
      points: 0,
      breakdown: {
        match_picks: 0,
        pool_positions: 0,
        semifinalists: 0,
        pool_top_attacking: 0,
        total_goals: 0,
        winner: 0,
        total: 0,
      },
    }));

    const participantIds = leaderboardRows.map((p) => p.participant_id);

    type CompPickRow = {
      participant_id: string;
      winner_team_code: string | null;
      semifinalist_team_codes: string[] | null;
      group_picks: Record<string, { first?: string; second?: string }> | null;
      total_goals: number | null;
      top_scoring_team_code: string | null;
    };

    const compPicksByParticipant = new Map<string, CompPickRow>();
    if (participantIds.length > 0) {
      const { data: compPicks, error: compPicksError } = await supabaseAdmin
        .from("worldcup_competition_picks")
        .select(
          "participant_id, winner_team_code, semifinalist_team_codes, group_picks, total_goals, top_scoring_team_code"
        )
        .eq("competition_id", tenant.competitionId)
        .in("participant_id", participantIds);

      if (compPicksError) {
        console.error("World Cup results competition picks:", compPicksError);
        return NextResponse.json({ error: "Failed to load competition picks" }, { status: 500 });
      }

      for (const row of compPicks || []) {
        compPicksByParticipant.set(row.participant_id, row as CompPickRow);
      }
    }

    const totalGoalsPredMap = new Map<string, number | null>();
    for (const id of participantIds) {
      totalGoalsPredMap.set(id, compPicksByParticipant.get(id)?.total_goals ?? null);
    }

    const totalGoalsPointsByParticipant = computeTotalGoalsPointsByParticipant({
      participantPredictions: totalGoalsPredMap,
      actualTotalGoals: compResultRow?.total_goals ?? null,
    });

    const matchPointsByParticipant = new Map<string, number>();
    for (const id of participantIds) matchPointsByParticipant.set(id, 0);

    const completedFixtureIds = fixturesWithResults.map((f) => f.id);

    if (participantIds.length > 0 && completedFixtureIds.length > 0) {
      const { data: picksRows, error: picksError } = await supabaseAdmin
        .from("picks")
        .select("participant_id, fixture_id, picked_team")
        .in("participant_id", participantIds)
        .in("fixture_id", completedFixtureIds);

      if (picksError) {
        console.error("World Cup results leaderboard picks:", picksError);
        return NextResponse.json({ error: "Failed to load leaderboard picks" }, { status: 500 });
      }

      for (const pick of picksRows || []) {
        const fixtureResult = resultByFixture[pick.fixture_id];
        if (!fixtureResult) continue;
        if (pick.picked_team === fixtureResult.winning_team) {
          matchPointsByParticipant.set(
            pick.participant_id,
            (matchPointsByParticipant.get(pick.participant_id) || 0) + WC_MATCH_PICK_POINTS
          );
        }
      }
    }

    const groupResults =
      compResultRow?.group_results && typeof compResultRow.group_results === "object"
        ? (compResultRow.group_results as Record<string, { first?: string; second?: string }>)
        : null;

    for (const row of leaderboardRows) {
      const cp = compPicksByParticipant.get(row.participant_id);
      const matchPts = matchPointsByParticipant.get(row.participant_id) || 0;
      const poolPts = scorePoolFinishingPositions(cp?.group_picks ?? null, groupResults);
      const semiPts = scoreSemiFinalistSlots(cp?.semifinalist_team_codes, compResultRow?.semifinalist_team_codes);
      const attackingPts = scorePoolTopAttackingPick(cp?.top_scoring_team_code, topPoolAttackingCodes);
      const tgPts = totalGoalsPointsByParticipant.get(row.participant_id) || 0;
      const winnerPts = scoreWinnerPick(cp?.winner_team_code, compResultRow?.winner_team_code);

      const core = {
        match_picks: matchPts,
        pool_positions: poolPts,
        semifinalists: semiPts,
        pool_top_attacking: attackingPts,
        total_goals: tgPts,
        winner: winnerPts,
      };
      row.breakdown = {
        ...core,
        total: sumBreakdown(core),
      };
      row.points = row.breakdown.total;
    }

    leaderboardRows.sort((a, b) => b.points - a.points || a.team_name.localeCompare(b.team_name));

    return NextResponse.json(
      { rounds: roundsFiltered, teamNames, leaderboard: leaderboardRows, tenant: tenant.slug },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup results route:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
