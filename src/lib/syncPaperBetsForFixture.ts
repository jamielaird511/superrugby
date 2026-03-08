import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DRAW_CODE = "DRAW";

type Outcome = "draw" | "home_1_12" | "home_13_plus" | "away_1_12" | "away_13_plus";

function pickToOutcome(
  pickedTeam: string,
  margin: number,
  homeTeamCode: string | null,
  awayTeamCode: string | null
): Outcome | null {
  if (pickedTeam === DRAW_CODE) return "draw";
  if (homeTeamCode && pickedTeam === homeTeamCode && margin === 1) return "home_1_12";
  if (homeTeamCode && pickedTeam === homeTeamCode && margin === 13) return "home_13_plus";
  if (awayTeamCode && pickedTeam === awayTeamCode && margin === 1) return "away_1_12";
  if (awayTeamCode && pickedTeam === awayTeamCode && margin === 13) return "away_13_plus";
  return null;
}

function getOddsForOutcome(
  odds: {
    draw_odds: number;
    home_1_12_odds: number;
    home_13_plus_odds: number;
    away_1_12_odds: number;
    away_13_plus_odds: number;
  },
  outcome: Outcome
): number {
  const map: Record<Outcome, number> = {
    draw: odds.draw_odds,
    home_1_12: odds.home_1_12_odds,
    home_13_plus: odds.home_13_plus_odds,
    away_1_12: odds.away_1_12_odds,
    away_13_plus: odds.away_13_plus_odds,
  };
  return map[outcome];
}

/**
 * For a fixture that now has match_odds: create missing paper_bets for all picks on that fixture,
 * and set kickoff_odds on existing paper_bets where null. Idempotent and safe to run multiple times.
 */
export async function syncPaperBetsForFixture(fixtureId: string): Promise<void> {
  const { data: fixture, error: fixErr } = await supabaseAdmin
    .from("fixtures")
    .select("id, home_team_code, away_team_code")
    .eq("id", fixtureId)
    .single();
  if (fixErr || !fixture) return;

  const { data: oddsRow, error: oddsErr } = await supabaseAdmin
    .from("match_odds")
    .select("draw_odds, home_1_12_odds, home_13_plus_odds, away_1_12_odds, away_13_plus_odds")
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (oddsErr || !oddsRow) return;

  const { data: picks, error: picksErr } = await supabaseAdmin
    .from("picks")
    .select("participant_id, league_id, picked_team, margin")
    .eq("fixture_id", fixtureId);
  if (picksErr || !picks?.length) {
    // Still backfill kickoff_odds for existing paper_bets
    await backfillKickoffOddsForFixture(fixtureId, oddsRow);
    return;
  }

  const home = fixture.home_team_code ?? null;
  const away = fixture.away_team_code ?? null;

  for (const pick of picks) {
    const outcome = pickToOutcome(pick.picked_team, pick.margin ?? 0, home, away);
    if (!outcome) continue;

    const oddsValue = getOddsForOutcome(oddsRow, outcome);
    if (typeof oddsValue !== "number" || Number(oddsValue) < 1.01) continue;

    await supabaseAdmin
      .from("paper_bets")
      .upsert(
        {
          participant_id: pick.participant_id,
          fixture_id: fixtureId,
          league_id: pick.league_id,
          outcome,
          stake: 10,
          odds: Number(oddsValue),
        },
        { onConflict: "participant_id,fixture_id" }
      );
  }

  await backfillKickoffOddsForFixture(fixtureId, oddsRow);
}

async function backfillKickoffOddsForFixture(
  fixtureId: string,
  oddsRow: {
    draw_odds: number;
    home_1_12_odds: number;
    home_13_plus_odds: number;
    away_1_12_odds: number;
    away_13_plus_odds: number;
  }
): Promise<void> {
  const { data: rows, error } = await supabaseAdmin
    .from("paper_bets")
    .select("id, outcome")
    .eq("fixture_id", fixtureId)
    .is("kickoff_odds", null);
  if (error || !rows?.length) return;

  for (const row of rows) {
    const outcome = row.outcome as Outcome;
    const val = getOddsForOutcome(oddsRow, outcome);
    if (typeof val !== "number" || val < 1.01) continue;
    await supabaseAdmin.from("paper_bets").update({ kickoff_odds: val }).eq("id", row.id);
  }
}
