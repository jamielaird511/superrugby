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

    // Determine which fixtures to analyze
    let allFixtureIds: string[] = [];

    if (mode === "round" && roundId) {
      // Fetch fixtures for specific round
      const { data: fixturesData, error: fixturesError } = await supabaseAdmin
        .from("fixtures")
        .select("id")
        .eq("round_id", roundId);

      if (fixturesError) {
        console.error("Error fetching round fixtures:", fixturesError);
        return NextResponse.json(
          { error: "Failed to fetch fixtures" },
          { status: 500 }
        );
      }

      allFixtureIds = (fixturesData || []).map((f) => f.id);
    } else {
      // Fetch fixtures for current season by joining with rounds
      const currentSeason = new Date().getFullYear();
      const { data: roundsData, error: roundsError } = await supabaseAdmin
        .from("rounds")
        .select("id")
        .eq("season", currentSeason);

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
          .in("round_id", roundIds);

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
        gutFeelWins: 0,
        secondGuessWins: 0,
        unchanged: 0,
        pointsGained: 0,
        pointsLost: 0,
        totalChanges: 0,
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
        gutFeelWins: 0,
        secondGuessWins: 0,
        unchanged: 0,
        pointsGained: 0,
        pointsLost: 0,
        totalChanges: 0,
        mostIndecisive: null,
      });
    }

    // Fetch fixtures with kickoff times (only those with results)
    const { data: fixturesData, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, round_id")
      .in("id", fixtureIdsWithResults);

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
    let gutFeelWins = 0;
    let secondGuessWins = 0;
    let unchanged = 0;
    let pointsGained = 0;
    let pointsLost = 0;
    let totalChanges = 0;
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
      const changes = events.length - 1;

      totalChanges += changes;

      if (delta > 0) {
        secondGuessWins++;
        pointsGained += delta;
      } else if (delta < 0) {
        gutFeelWins++;
        pointsLost += Math.abs(delta);
      } else {
        unchanged++;
      }

      // Track most indecisive
      if (!mostIndecisive || changes > mostIndecisive.changes) {
        mostIndecisive = {
          fixture_id: fixtureId,
          changes,
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

    const response: any = {
      mode,
      fixtures_scored: fixturesScored,
      gutFeelWins,
      secondGuessWins,
      unchanged,
      pointsGained,
      pointsLost,
      totalChanges,
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
