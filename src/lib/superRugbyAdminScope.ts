import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Primary Super Rugby league used by `/admin` (fixtures, rounds, picks). */
export const SUPER_RUGBY_ADMIN_LEAGUE_CODE = "ANZ2026" as const;

export async function getSuperRugbyAdminCompetitionId(
  client: SupabaseClient
): Promise<string | null> {
  const { data, error } = await client
    .from("leagues")
    .select("competition_id")
    .eq("league_code", SUPER_RUGBY_ADMIN_LEAGUE_CODE)
    .maybeSingle();
  if (error || !data?.competition_id) return null;
  return data.competition_id as string;
}
