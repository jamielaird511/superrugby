import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIFA_WORLD_CUP_2026_COMPETITION_ID,
  FIFA_WORLD_CUP_2026_LEAGUE_ID,
} from "./worldCupIds";

/**
 * Expected `leagues.league_code` for the FIFA World Cup picks league (when present).
 * If your row uses a different code, prefer resolving via `league_id` below or align the DB.
 */
export const WORLD_CUP_LEAGUE_CODE = "FIFAWC2026" as const;

/**
 * Canonical FIFA World Cup 2026 competition id (always safe for query filters).
 */
export const WORLD_CUP_COMPETITION_ID = FIFA_WORLD_CUP_2026_COMPETITION_ID;

/**
 * Resolves the World Cup `competition_id` for scoping World Cup admin and APIs.
 * 1) Validates `leagues` row by `WORLD_CUP_LEAGUE_CODE` when it matches the canonical id.
 * 2) Else validates by known `league` UUID (`FIFA_WORLD_CUP_2026_LEAGUE_ID`).
 * 3) If the league row is missing, returns the hardcoded competition id (same constant as public WC routes).
 * Returns `null` only when a league row exists but its `competition_id` does not match the canonical World Cup id.
 */
export async function getWorldCupCompetitionId(
  client: SupabaseClient
): Promise<string | null> {
  const { data: byCode, error: errCode } = await client
    .from("leagues")
    .select("competition_id")
    .eq("league_code", WORLD_CUP_LEAGUE_CODE)
    .maybeSingle();

  if (!errCode && byCode?.competition_id) {
    if (byCode.competition_id !== FIFA_WORLD_CUP_2026_COMPETITION_ID) {
      return null;
    }
    return byCode.competition_id as string;
  }

  const { data: byId, error: errId } = await client
    .from("leagues")
    .select("competition_id")
    .eq("id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
    .maybeSingle();

  if (!errId && byId?.competition_id) {
    if (byId.competition_id !== FIFA_WORLD_CUP_2026_COMPETITION_ID) {
      return null;
    }
    return byId.competition_id as string;
  }

  return FIFA_WORLD_CUP_2026_COMPETITION_ID;
}
