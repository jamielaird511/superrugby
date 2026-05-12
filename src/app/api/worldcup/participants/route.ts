import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FIFA_WORLD_CUP_2026_LEAGUE_ID = "a908c579-842c-43c8-85d3-229b543bb2a3";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, name, team_name")
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
      .order("team_name", { ascending: true });

    if (error) {
      console.error("World Cup participants fetch error:", error);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    return NextResponse.json(
      { participants: data || [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("World Cup participants route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
