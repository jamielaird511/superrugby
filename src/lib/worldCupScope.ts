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
 * Returns the World Cup `competition_id` for this tenant. Multiple tenants may share the same
 * competition (shared fixture schedule); participants/picks stay scoped by `league_id` instead.
 *
 * Validates that the tenant's `leagues` row matches `tenant.competition_id` when present.
 * If the league row is missing, falls back to `tenant.competitionId`.
 * Returns `null` if a league row exists but its `competition_id` does not match the tenant.
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
