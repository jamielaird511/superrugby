/** World Cup fantasy scoring (isolated from Super Rugby). */

export const WC_MATCH_PICK_POINTS = 5;
export const WC_POOL_POSITION_POINTS = 15;
export const WC_SEMIFINALIST_POINTS = 20;
export const WC_POOL_TOP_ATTACKING_POINTS = 25;
export const WC_TOTAL_GOALS_CLOSEST_POINTS = 40;
export const WC_TOTAL_GOALS_EXACT_BONUS = 10;
export const WC_TOTAL_GOALS_WITHIN_10_BONUS = 10;
export const WC_WINNER_POINTS = 50;

/** Group-stage matchday rounds in this app: 101–199 (see `roundLabel` in WC API). */
export function isWorldCupGroupStageRoundNumber(roundNumber: number): boolean {
  return Number.isFinite(roundNumber) && roundNumber >= 101 && roundNumber <= 199;
}

export function normalizeTeamCode(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t ? t.toUpperCase() : null;
}

export type GroupSlotPicks = Record<string, { first?: string | null; second?: string | null }>;

/** Add goals scored (not conceded) per team from group-stage fixtures with a final score. */
export function accumulatePoolPlayGoalsScored(
  fixtures: Array<{
    id: string;
    round_id: string;
    home_team_code: string;
    away_team_code: string;
  }>,
  roundNumberByRoundId: Record<string, number>,
  resultByFixtureId: Record<
    string,
    { home_goals: number | null; away_goals: number | null } | undefined
  >
): Record<string, number> {
  const goals: Record<string, number> = {};
  for (const fx of fixtures) {
    const rn = roundNumberByRoundId[fx.round_id];
    if (!isWorldCupGroupStageRoundNumber(rn)) continue;

    const res = resultByFixtureId[fx.id];
    if (!res || res.home_goals == null || res.away_goals == null) continue;

    const home = normalizeTeamCode(fx.home_team_code);
    const away = normalizeTeamCode(fx.away_team_code);
    if (!home || !away) continue;

    goals[home] = (goals[home] ?? 0) + res.home_goals;
    goals[away] = (goals[away] ?? 0) + res.away_goals;
  }
  return goals;
}

/** Teams tied for the maximum pool-play goals; empty if none scored. */
export function topPoolPlayScoringTeamCodes(goalsByTeam: Record<string, number>): Set<string> {
  const entries = Object.entries(goalsByTeam);
  if (entries.length === 0) return new Set();
  let max = -1;
  for (const [, g] of entries) {
    if (g > max) max = g;
  }
  if (max < 0) return new Set();
  const out = new Set<string>();
  for (const [code, g] of entries) {
    if (g === max) out.add(code);
  }
  return out;
}

export function scoreMatchPicks(
  picks: Array<{ fixture_id: string; picked_team: string }>,
  resultByFixtureId: Record<string, { winning_team: string } | undefined>
): number {
  let pts = 0;
  for (const pick of picks) {
    const res = resultByFixtureId[pick.fixture_id];
    if (!res) continue;
    if (pick.picked_team === res.winning_team) pts += WC_MATCH_PICK_POINTS;
  }
  return pts;
}

function pickRowForGroupKey(
  picks: GroupSlotPicks | null | undefined,
  groupKey: string
): { first?: string | null; second?: string | null } | undefined {
  if (!picks || typeof picks !== "object") return undefined;
  if (picks[groupKey]) return picks[groupKey];
  const nk = groupKey.trim().toLowerCase();
  for (const k of Object.keys(picks)) {
    if (k.trim().toLowerCase() === nk) return picks[k];
  }
  return undefined;
}

/** 15 per correct 1st and 15 per correct 2nd when actual row has both places set. */
export function scorePoolFinishingPositions(
  picks: GroupSlotPicks | null | undefined,
  actualGroupResults: GroupSlotPicks | null | undefined
): number {
  if (!actualGroupResults || typeof actualGroupResults !== "object") return 0;
  let pts = 0;
  for (const [groupKey, actualRow] of Object.entries(actualGroupResults)) {
    const a1 = normalizeTeamCode(actualRow?.first);
    const a2 = normalizeTeamCode(actualRow?.second);
    if (!a1 || !a2) continue;

    const pickRow = pickRowForGroupKey(picks, groupKey);
    if (!pickRow) continue;

    const p1 = normalizeTeamCode(pickRow.first);
    const p2 = normalizeTeamCode(pickRow.second);
    if (p1 && p1 === a1) pts += WC_POOL_POSITION_POINTS;
    if (p2 && p2 === a2) pts += WC_POOL_POSITION_POINTS;
  }
  return pts;
}

/** Full semi line-up: first four non-empty codes must be four distinct teams. */
export function scoreSemiFinalistSlots(
  predictedSlots: string[] | null | undefined,
  actualSlots: string[] | null | undefined
): number {
  const actualCodes = (actualSlots || [])
    .map((c) => normalizeTeamCode(c))
    .filter((c): c is string => Boolean(c));
  if (actualCodes.length < 4) return 0;
  const firstFour = actualCodes.slice(0, 4);
  const actualSet = new Set(firstFour);
  if (actualSet.size < 4) return 0;

  const preds = predictedSlots || [];
  let pts = 0;
  for (let i = 0; i < 4; i++) {
    const p = normalizeTeamCode(preds[i]);
    if (p && actualSet.has(p)) pts += WC_SEMIFINALIST_POINTS;
  }
  return pts;
}

export function scorePoolTopAttackingPick(
  pick: string | null | undefined,
  topTeamCodes: Set<string>
): number {
  if (topTeamCodes.size === 0) return 0;
  const p = normalizeTeamCode(pick);
  if (!p) return 0;
  return topTeamCodes.has(p) ? WC_POOL_TOP_ATTACKING_POINTS : 0;
}

export function scoreWinnerPick(pick: string | null | undefined, actualWinner: string | null | undefined): number {
  const a = normalizeTeamCode(actualWinner);
  const p = normalizeTeamCode(pick);
  if (!a || !p) return 0;
  return p === a ? WC_WINNER_POINTS : 0;
}

export type TotalGoalsPointsInput = {
  participantPredictions: Map<string, number | null>;
  actualTotalGoals: number | null;
};

/** Closest (shared), +10 exact, +10 within 10 (stacking). Unknown actual → 0 for everyone. */
export function computeTotalGoalsPointsByParticipant({
  participantPredictions,
  actualTotalGoals,
}: TotalGoalsPointsInput): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of participantPredictions.keys()) out.set(id, 0);

  if (actualTotalGoals == null || !Number.isFinite(actualTotalGoals)) {
    return out;
  }

  const withNumeric = [...participantPredictions.entries()].filter(
    (entry): entry is [string, number] =>
      entry[1] !== null && Number.isFinite(entry[1]) && typeof entry[1] === "number"
  );

  if (withNumeric.length === 0) {
    return out;
  }

  const distances = withNumeric.map(([id, pred]) => ({
    id,
    d: Math.abs(pred - actualTotalGoals!),
  }));
  const minD = Math.min(...distances.map((x) => x.d));

  for (const id of participantPredictions.keys()) {
    const pred = participantPredictions.get(id);
    if (pred === null || pred === undefined || !Number.isFinite(pred)) continue;

    const d = Math.abs(pred - actualTotalGoals);
    let pts = 0;
    if (d === minD) pts += WC_TOTAL_GOALS_CLOSEST_POINTS;
    if (pred === actualTotalGoals) pts += WC_TOTAL_GOALS_EXACT_BONUS;
    if (d <= 10) pts += WC_TOTAL_GOALS_WITHIN_10_BONUS;
    out.set(id, pts);
  }

  return out;
}

export type WorldCupLeaderboardBreakdown = {
  match_picks: number;
  pool_positions: number;
  semifinalists: number;
  pool_top_attacking: number;
  total_goals: number;
  winner: number;
  total: number;
};

export function sumBreakdown(b: Omit<WorldCupLeaderboardBreakdown, "total">): number {
  return (
    b.match_picks +
    b.pool_positions +
    b.semifinalists +
    b.pool_top_attacking +
    b.total_goals +
    b.winner
  );
}
