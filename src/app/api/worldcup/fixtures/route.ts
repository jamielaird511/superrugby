import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FIFA_WORLD_CUP_2026_COMPETITION_ID = "9e60564e-4be5-4756-b6cb-48ae06f45654";

export async function GET() {
  try {
    const nowISO = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("fixtures")
      .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
      .eq("competition_id", FIFA_WORLD_CUP_2026_COMPETITION_ID)
      .gt("kickoff_at", nowISO)
      .order("kickoff_at", { ascending: true });

    if (error) {
      console.error("World Cup fixtures fetch error:", error);
      return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
    }

    return NextResponse.json({ fixtures: data || [] }, { status: 200 });
  } catch (err) {
    console.error("World Cup fixtures route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
