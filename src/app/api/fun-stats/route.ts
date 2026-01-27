import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculatePickScore, getMarginBand } from "@/lib/scoring";

type PickEvent = {
  id: string;
  participant_id: string;
  fixture_id: string;
  picked_team: string;
  margin: number;
  created_at: string;
};

type Fixture = {
  id: string;
  kickoff_at: string | null;
  round_id: string;
};

type Result = {
  fixture_id: string;
  winning_team: string;
  margin_band: string | null;
};

type Round = {
  id: string;
  round_number: number;
  season: number;
};


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participantId");
    const roundId = searchParams.get("roundId");
    const mode = (searchParams.get("mode") || "season") as "round" | "season";
    const debug = searchParams.get("debug") === "true";

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required" },
        { status: 400 }
      );
    }

    // Get participant's league_id
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("league_id")
      .eq("id", participantId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    const leagueId = participant.league_id;

    // Look up competition_id for this league
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("competition_id")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      console.error("Error fetching league for fun-stats:", leagueError);
      return NextResponse.json(
        { error: "League not found for participant" },
        { status: 500 }
      );
    }

    const competitionId = league.competition_id;

    // Determine which fixtures to analyze
    let allFixtureIds: string[] = [];

    if (mode === "round" && roundId) {
      // Fetch fixtures for specific round within the participant's competition
      const { data: fixturesData, error: fixturesError } = await supabaseAdmin
        .from("fixtures")
        .select("id")
        .eq("round_id", roundId)
        .eq("competition_id", competitionId);

      if (fixturesError) {
        console.error("Error fetching round fixtures:", fixturesError);
        return NextResponse.json(
          { error: "Failed to fetch fixtures" },
          { status: 500 }
        );
      }

      allFixtureIds = (fixturesData || []).map((f) => f.id);
    } else {
      // Fetch fixtures for current season and competition by joining with rounds
      const currentSeason = new Date().getFullYear();
      const { data: roundsData, error: roundsError } = await supabaseAdmin
        .from("rounds")
        .select("id")
        .eq("season", currentSeason)
        .eq("competition_id", competitionId);

      if (roundsError) {
        console.error("Error fetching rounds:", roundsError);
        return NextResponse.json(
          { error: "Failed to fetch rounds" },
          { status: 500 }
        );
      }

      const roundIds = (roundsData || []).map((r) => r.id);
      if (roundIds.length > 0) {
        const { data: fixturesData, error: fixturesError } = await supabaseAdmin
          .from("fixtures")
          .select("id")
          .in("round_id", roundIds)
          .eq("competition_id", competitionId);

        if (fixturesError) {
          console.error("Error fetching season fixtures:", fixturesError);
          return NextResponse.json(
            { error: "Failed to fetch fixtures" },
            { status: 500 }
          );
        }

        allFixtureIds = (fixturesData || []).map((f) => f.id);
      }
    }

    if (allFixtureIds.length === 0) {
      return NextResponse.json({
        mode,
        fixtures_scored: 0,
        picksChanged: 0,
        initialRight: 0,
        finalRight: 0,
        noEffect: 0,
        pointsGained: 0,
        pointsLost: 0,
        netPoints: 0,
        totalChanges: 0,
        totalEdits: 0,
        gutFeelWins: 0,
        secondGuessWins: 0,
        unchanged: 0,
        mostIndecisive: null,
      });
    }

    // Fetch results for these fixtures - only process fixtures that have results
    const { data: resultsData, error: resultsError } = await supabaseAdmin
      .from("results")
      .select("fixture_id, winning_team, margin_band")
      .in("fixture_id", allFixtureIds);

    if (resultsError) {
      console.error("Error fetching results:", resultsError);
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }

    // Only process fixtures that have results
    const fixtureIdsWithResults = (resultsData || []).map((r) => r.fixture_id);
    
    if (fixtureIdsWithResults.length === 0) {
      return NextResponse.json({
        mode,
        fixtures_scored: 0,
        picksChanged: 0,
        initialRight: 0,
        finalRight: 0,
        noEffect: 0,
        pointsGained: 0,
        pointsLost: 0,
        netPoints: 0,
        totalChanges: 0,
        totalEdits: 0,
        gutFeelWins: 0,
        secondGuessWins: 0,
        unchanged: 0,
        mostIndecisive: null,
      });
    }

    // Fetch fixtures with kickoff times (only those with results) and filter by competition
    const { data: fixturesData, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, round_id")
      .in("id", fixtureIdsWithResults)
      .eq("competition_id", competitionId);

    if (fixturesError) {
      console.error("Error fetching fixtures:", fixturesError);
      return NextResponse.json(
        { error: "Failed to fetch fixtures" },
        { status: 500 }
      );
    }

    const fixtures: Record<string, Fixture> = {};
    (fixturesData || []).forEach((f) => {
      fixtures[f.id] = f;
    });

    const results: Record<string, Result> = {};
    (resultsData || []).forEach((r) => {
      results[r.fixture_id] = r;
    });

    // Fetch pick events for this participant and these fixtures (only fixtures with results)
    // Note: pick_events table doesn't have league_id, but we filter by participant_id and fixture_id
    // which are already scoped to the league via the fixtures query above
    const { data: eventsData, error: eventsError } = await supabaseAdmin
      .from("pick_events")
      .select("id, participant_id, fixture_id, picked_team, margin, created_at")
      .eq("participant_id", participantId)
      .in("fixture_id", fixtureIdsWithResults)
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("Error fetching pick events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch pick events" },
        { status: 500 }
      );
    }

    // Group events by fixture
    const eventsByFixture: Record<string, PickEvent[]> = {};
    (eventsData || []).forEach((event) => {
      if (!eventsByFixture[event.fixture_id]) {
        eventsByFixture[event.fixture_id] = [];
      }
      eventsByFixture[event.fixture_id].push(event);
    });

    // Process each fixture with a result
    let fixturesScored = 0;
    let picksChanged = 0;
    let initialRight = 0;
    let finalRight = 0;
    let noEffect = 0;
    let pointsGained = 0;
    let pointsLost = 0;
    let totalEdits = 0;
    let netPoints = 0;
    let mostIndecisive: {
      fixture_id: string;
      changes: number;
      first_pick: { picked_team: string; margin: number };
      final_pick: { picked_team: string; margin: number };
      first_points: number;
      final_points: number;
      delta: number;
    } | null = null;

    const debugFixtures: Array<{
      fixture_id: string;
      kickoff_at: string | null;
      winning_team: string;
      result_margin_band: string | null;
      events_count: number;
      first_pick: { team: string; margin_band: string | null; created_at: string };
      final_pick: { team: string; margin_band: string | null; created_at: string };
      first_points: number;
      final_points: number;
      delta: number;
    }> = [];

    Object.keys(results).forEach((fixtureId) => {
      const result = results[fixtureId];
      const fixture = fixtures[fixtureId];
      const events = eventsByFixture[fixtureId] || [];

      if (events.length === 0) return; // No picks for this fixture

      fixturesScored++;

      // First pick = earliest event
      const firstPick = events[0];
      const firstScore = calculatePickScore(firstPick.picked_team, firstPick.margin, {
        winning_team: result.winning_team,
        margin_band: result.margin_band,
      });
      const firstPoints = firstScore.totalPoints;

      // Final pick = latest event with created_at <= kickoff_at (if kickoff exists), otherwise latest overall
      let finalPick: PickEvent;
      if (fixture.kickoff_at) {
        const kickoffTime = new Date(fixture.kickoff_at);
        const validEvents = events.filter((e) => new Date(e.created_at) <= kickoffTime);
        finalPick = validEvents.length > 0 ? validEvents[validEvents.length - 1] : events[events.length - 1];
      } else {
        finalPick = events[events.length - 1];
      }

      const finalScore = calculatePickScore(finalPick.picked_team, finalPick.margin, {
        winning_team: result.winning_team,
        margin_band: result.margin_band,
      });
      const finalPoints = finalScore.totalPoints;
      const delta = finalPoints - firstPoints;
      const edits = Math.max(events.length - 1, 0);

      totalEdits += edits;

      // Check if pick actually changed (team or margin)
      const firstKey = `${firstPick.picked_team}|${firstPick.margin}`;
      const finalKey = `${finalPick.picked_team}|${finalPick.margin}`;
      const didChange = firstKey !== finalKey;

      // Only update gauge buckets if pick changed
      if (didChange) {
        picksChanged++;

        if (delta > 0) {
          finalRight++;
          pointsGained += delta;
        } else if (delta < 0) {
          initialRight++;
          pointsLost += Math.abs(delta);
        } else {
          noEffect++;
        }

        netPoints += delta;
      }

      // Track most indecisive
      if (!mostIndecisive || edits > mostIndecisive.changes) {
        mostIndecisive = {
          fixture_id: fixtureId,
          changes: edits,
          first_pick: {
            picked_team: firstPick.picked_team,
            margin: firstPick.margin,
          },
          final_pick: {
            picked_team: finalPick.picked_team,
            margin: finalPick.margin,
          },
          first_points: firstPoints,
          final_points: finalPoints,
          delta,
        };
      }

      // Collect debug details if enabled
      if (debug) {
        debugFixtures.push({
          fixture_id: fixtureId,
          kickoff_at: fixture.kickoff_at,
          winning_team: result.winning_team,
          result_margin_band: result.margin_band,
          events_count: events.length,
          first_pick: {
            team: firstPick.picked_team,
            margin_band: getMarginBand(firstPick.margin),
            created_at: firstPick.created_at,
          },
          final_pick: {
            team: finalPick.picked_team,
            margin_band: getMarginBand(finalPick.margin),
            created_at: finalPick.created_at,
          },
          first_points: firstPoints,
          final_points: finalPoints,
          delta,
        });
      }
    });

    const response: {
      mode: string;
      fixtures_scored: number;
      picksChanged: number;
      initialRight: number;
      finalRight: number;
      noEffect: number;
      pointsGained: number;
      pointsLost: number;
      netPoints: number;
      totalChanges: number;
      totalEdits: number;
      // Backward compatibility fields
      gutFeelWins: number;
      secondGuessWins: number;
      unchanged: number;
      mostIndecisive: {
        fixture_id: string;
        changes: number;
        first_pick: { picked_team: string; margin: number };
        final_pick: { picked_team: string; margin: number };
        first_points: number;
        final_points: number;
        delta: number;
      } | null;
      fixtures?: Array<{
        fixture_id: string;
        kickoff_at: string | null;
        winning_team: string;
        result_margin_band: string | null;
        events_count: number;
        first_pick: { team: string; margin_band: string | null; created_at: string };
        final_pick: { team: string; margin_band: string | null; created_at: string };
        first_points: number;
        final_points: number;
        delta: number;
      }>;
    } = {
      mode,
      fixtures_scored: fixturesScored,
      picksChanged,
      initialRight,
      finalRight,
      noEffect,
      pointsGained,
      pointsLost,
      netPoints,
      totalChanges: picksChanged, // Backward compatibility: UI currently uses this for "Picks Changed" display
      totalEdits, // Total edit events across all fixtures
      // Backward compatibility
      gutFeelWins: initialRight,
      secondGuessWins: finalRight,
      unchanged: noEffect,
      mostIndecisive,
    };

    if (debug) {
      response.fixtures = debugFixtures;
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error("Get fun stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
