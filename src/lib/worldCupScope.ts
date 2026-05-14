import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FIFA_WORLD_CUP_2026_COMPETITION_ID,
  FIFA_WORLD_CUP_2026_LEAGUE_ID,
  getDefaultWorldCupTenant,
  type WorldCupTenant,
} from "./worldCupIds";

/** Legacy: World Cup league_code for the default tenant. */
export const WORLD_CUP_LEAGUE_CODE = "FIFAWC2026" as const;

/** Legacy: canonical default-tenant competition id for safe query filters. */
export const WORLD_CUP_COMPETITION_ID = FIFA_WORLD_CUP_2026_COMPETITION_ID;

/**
 * Validates that the given tenant's competition_id is reachable via the tenant's `leagues` row,
 * returning the competition_id. If the league row is missing, falls back to the registered
 * competition_id. Returns `null` if a league row exists but does not match the expected competition.
 */
export async function resolveWorldCupCompetitionIdForTenant(
  client: SupabaseClient,
  tenant: WorldCupTenant
): Promise<string | null> {
  const { data, error } = await client
    .from("leagues")
    .select("competition_id")
    .eq("id", tenant.leagueId)
    .maybeSingle();

  if (!error && data?.competition_id) {
    if (data.competition_id !== tenant.competitionId) return null;
    return data.competition_id as string;
  }
  return tenant.competitionId;
}

/**
 * Legacy single-tenant resolver — preserved for admin code paths that have not yet
 * been migrated. Resolves the default tenant only.
 */
export async function getWorldCupCompetitionId(
  client: SupabaseClient
): Promise<string | null> {
  return resolveWorldCupCompetitionIdForTenant(client, getDefaultWorldCupTenant());
}

/** Re-export for callers importing from the scope module. */
export { FIFA_WORLD_CUP_2026_COMPETITION_ID, FIFA_WORLD_CUP_2026_LEAGUE_ID };
