import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Read-only team display data for World Cup participant UI (flags, labels).
 * Avoids browser Supabase / RLS for `world_cup_teams` and `super_rugby_teams`.
 */
export async function GET() {
  try {
    const [rugbyRes, wcRes] = await Promise.all([
      supabaseAdmin
        .from("super_rugby_teams")
        .select("code, name")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("world_cup_teams")
        .select("code, name, flag_emoji, flag_url")
        .order("code", { ascending: true }),
    ]);

    if (rugbyRes.error) {
      console.error("[GET /api/worldcup/teams-metadata] super_rugby_teams", rugbyRes.error);
      return NextResponse.json(
        {
          error: "Failed to load team names",
          details: rugbyRes.error.message,
        },
        { status: 500 }
      );
    }
    if (wcRes.error) {
      console.error("[GET /api/worldcup/teams-metadata] world_cup_teams", wcRes.error);
      return NextResponse.json(
        {
          error: "Failed to load World Cup teams",
          details: wcRes.error.message,
        },
        { status: 500 }
      );
    }

    const teamNamesByCode: Record<string, string> = {};
    for (const row of rugbyRes.data || []) {
      if (row.code) teamNamesByCode[row.code] = row.name;
    }

    const worldCupTeams: Array<{
      code: string;
      name: string;
      flag_emoji: string | null;
      flag_url: string | null;
    }> = [];
    for (const row of wcRes.data || []) {
      const c = row.code?.trim();
      if (!c) continue;
      worldCupTeams.push({
        code: c,
        name: row.name,
        flag_emoji: row.flag_emoji ?? null,
        flag_url: row.flag_url ?? null,
      });
    }

    return NextResponse.json({ teamNamesByCode, worldCupTeams }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/worldcup/teams-metadata] unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
