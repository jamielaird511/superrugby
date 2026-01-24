export type Result = {
  winning_team: string;
  margin_band: string | null;
};

export type PickScore = {
  winnerPoints: number;
  marginPoints: number;
  totalPoints: number;
};

/**
 * Calculate points for a pick against a result.
 * 
 * Rules:
 * 1) If picked_team !== winning_team => 0 points total (ignore margin)
 * 2) If picked_team === winning_team => 5 points
 * 3) If picked_team === winning_team AND picked margin band matches actual margin band => +3 points (total 8)
 *    - Margin bonus excluded when pickedTeam or winning_team is "DRAW"
 */
export function calculatePickScore(
  pickedTeam: string,
  margin: number | null | undefined,
  result: Result
): PickScore {
  // Rule 1: If picked_team !== winning_team => 0 points total (ignore margin)
  if (pickedTeam !== result.winning_team) {
    return { winnerPoints: 0, marginPoints: 0, totalPoints: 0 };
  }

  // Rule 2: If picked_team === winning_team => 5 points
  const winnerPoints = 5;

  // Rule 3: If picked_team === winning_team AND picked margin band matches actual margin band => +3 points (total 8)
  // Margin bonus excluded when pickedTeam or winning_team is "DRAW"
  let marginPoints = 0;
  if (pickedTeam !== "DRAW" && result.winning_team !== "DRAW" && result.margin_band) {
    const pickMarginBand = getMarginBand(margin);
    if (pickMarginBand === result.margin_band) {
      marginPoints = 3;
    }
  }

  return {
    winnerPoints,
    marginPoints,
    totalPoints: winnerPoints + marginPoints,
  };
}

/**
 * Convert a numeric margin to a margin band string.
 * Returns null if margin is null, undefined, not a valid number, or < 1.
 */
export function getMarginBand(margin: number | null | undefined): string | null {
  if (margin == null || typeof margin !== "number" || margin < 1) {
    return null;
  }
  if (margin >= 1 && margin <= 12) return "1-12";
  if (margin >= 13) return "13+";
  return null;
}
