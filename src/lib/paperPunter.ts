import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type PaperPunterResult = {
  participant_id: string;
  team_name: string;
  staked: number;
  return: number;
  profit: number;
  roi: number;
  biggest_hit: number;
  prophet_score: number;
};

type PickBucket = "DRAW" | "HOME_1_12" | "HOME_13_PLUS" | "AWAY_1_12" | "AWAY_13_PLUS";

/**
 * Map a pick to a bucket
 */
function pickToBucket(
  pickedTeam: string,
  margin: number | null,
  homeTeamCode: string,
  awayTeamCode: string
): PickBucket | null {
  if (pickedTeam === "DRAW") {
    return "DRAW";
  }
  if (pickedTeam === homeTeamCode) {
    if (margin === 1) return "HOME_1_12";
    if (margin === 13) return "HOME_13_PLUS";
  }
  if (pickedTeam === awayTeamCode) {
    if (margin === 1) return "AWAY_1_12";
    if (margin === 13) return "AWAY_13_PLUS";
  }
  return null;
}

/**
 * Map a result to a bucket
 */
function resultToBucket(
  winningTeam: string,
  marginBand: string | null,
  homeTeamCode: string,
  awayTeamCode: string
): PickBucket | null {
  if (winningTeam === "DRAW") {
    return "DRAW";
  }
  if (winningTeam === homeTeamCode) {
    if (marginBand === "1-12") return "HOME_1_12";
    if (marginBand === "13+") return "HOME_13_PLUS";
  }
  if (winningTeam === awayTeamCode) {
    if (marginBand === "1-12") return "AWAY_1_12";
    if (marginBand === "13+") return "AWAY_13_PLUS";
  }
  return null;
}

/**
 * Get odds for a bucket
 */
function getOddsForBucket(
  odds: {
    draw_odds: number;
    home_1_12_odds: number;
    home_13_plus_odds: number;
    away_1_12_odds: number;
    away_13_plus_odds: number;
  },
  bucket: PickBucket
): number {
  switch (bucket) {
    case "DRAW":
      return odds.draw_odds;
    case "HOME_1_12":
      return odds.home_1_12_odds;
    case "HOME_13_PLUS":
      return odds.home_13_plus_odds;
    case "AWAY_1_12":
      return odds.away_1_12_odds;
    case "AWAY_13_PLUS":
      return odds.away_13_plus_odds;
  }
}

/**
 * Calculate paper punter results for a round
 */
export async function calculatePaperPunter(
  roundId: string
): Promise<PaperPunterResult[]> {
  // Fetch fixtures for the round
  const { data: fixtures, error: fixturesError } = await supabaseAdmin
    .from("fixtures")
    .select("id, home_team_code, away_team_code")
    .eq("round_id", roundId);

  if (fixturesError || !fixtures) {
    throw new Error(`Failed to fetch fixtures: ${fixturesError?.message}`);
  }

  const fixtureIds = fixtures.map((f) => f.id);
  if (fixtureIds.length === 0) {
    return [];
  }

  // Fetch odds for fixtures (only include fixtures with odds)
  const { data: oddsData, error: oddsError } = await supabaseAdmin
    .from("match_odds")
    .select("*")
    .in("fixture_id", fixtureIds);

  if (oddsError) {
    throw new Error(`Failed to fetch odds: ${oddsError.message}`);
  }

  const oddsMap = new Map(
    (oddsData || []).map((o) => [o.fixture_id, o])
  );

  // Only process fixtures that have odds
  const fixturesWithOdds = fixtures.filter((f) => oddsMap.has(f.id));

  if (fixturesWithOdds.length === 0) {
    return [];
  }

  // Fetch results for fixtures (only include fixtures with results)
  const { data: resultsData, error: resultsError } = await supabaseAdmin
    .from("results")
    .select("fixture_id, winning_team, margin_band")
    .in("fixture_id", fixturesWithOdds.map((f) => f.id));

  if (resultsError) {
    throw new Error(`Failed to fetch results: ${resultsError.message}`);
  }

  const resultsMap = new Map(
    (resultsData || []).map((r) => [r.fixture_id, r])
  );

  // Only process fixtures that have both odds and results
  const validFixtures = fixturesWithOdds.filter((f) => resultsMap.has(f.id));

  if (validFixtures.length === 0) {
    return [];
  }

  // Fetch all picks for these fixtures
  const { data: picksData, error: picksError } = await supabaseAdmin
    .from("picks")
    .select("participant_id, fixture_id, picked_team, margin")
    .in("fixture_id", validFixtures.map((f) => f.id));

  if (picksError) {
    throw new Error(`Failed to fetch picks: ${picksError.message}`);
  }

  // Fetch participants for team names
  const participantIds = Array.from(
    new Set((picksData || []).map((p) => p.participant_id))
  );

  if (participantIds.length === 0) {
    return [];
  }

  const { data: participantsData, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("id, team_name")
    .in("id", participantIds);

  if (participantsError) {
    throw new Error(`Failed to fetch participants: ${participantsError.message}`);
  }

  const participantsMap = new Map(
    (participantsData || []).map((p) => [p.id, p])
  );

  // Group picks by participant
  const picksByParticipant = new Map<string, typeof picksData>();
  (picksData || []).forEach((pick) => {
    if (!picksByParticipant.has(pick.participant_id)) {
      picksByParticipant.set(pick.participant_id, []);
    }
    picksByParticipant.get(pick.participant_id)!.push(pick);
  });

  // Calculate results per participant
  const results: PaperPunterResult[] = [];

  for (const [participantId, picks] of picksByParticipant) {
    const participant = participantsMap.get(participantId);
    if (!participant) continue;

    let staked = 0;
    let returnAmount = 0;
    let biggestHit = 0;
    let prophetScore = 0;

    // Process each valid fixture
    for (const fixture of validFixtures) {
      const pick = picks.find((p) => p.fixture_id === fixture.id);
      if (!pick) {
        // No pick for this match = no bet placed, exclude from staked
        continue;
      }

      const odds = oddsMap.get(fixture.id);
      const result = resultsMap.get(fixture.id);
      if (!odds || !result) continue;

      // Stake $10 per match
      staked += 10;

      // Map pick and result to buckets
      const pickBucket = pickToBucket(
        pick.picked_team,
        pick.margin,
        fixture.home_team_code,
        fixture.away_team_code
      );
      const resultBucket = resultToBucket(
        result.winning_team,
        result.margin_band,
        fixture.home_team_code,
        fixture.away_team_code
      );

      if (pickBucket && resultBucket && pickBucket === resultBucket) {
        // Correct pick!
        const oddsValue = getOddsForBucket(odds, pickBucket);
        const winAmount = 10 * oddsValue;
        returnAmount += winAmount;
        const profit = 10 * (oddsValue - 1);
        biggestHit = Math.max(biggestHit, profit);
        prophetScore += oddsValue - 1; // Use (odds - 1) for difficulty/profit
      } else {
        // Incorrect pick - still staked $10 but no return
      }
    }

    const profit = returnAmount - staked;
    const roi = staked > 0 ? (profit / staked) * 100 : 0;

    results.push({
      participant_id: participantId,
      team_name: participant.team_name || "Unknown",
      staked,
      return: returnAmount,
      profit,
      roi,
      biggest_hit: biggestHit,
      prophet_score: prophetScore,
    });
  }

  // Sort by profit descending, then by prophet_score descending
  results.sort((a, b) => {
    if (b.profit !== a.profit) {
      return b.profit - a.profit;
    }
    return b.prophet_score - a.prophet_score;
  });

  return results;
}
