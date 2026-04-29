import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FIFA_WORLD_CUP_2026_LEAGUE_ID = "a908c579-842c-43c8-85d3-229b543bb2a3";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = (searchParams.get("participantId") || "").trim();

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, name, team_name, league_id")
      .eq("id", participantId)
      .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
      .maybeSingle();

    if (error) {
      console.error("World Cup participant fetch error:", error);
      return NextResponse.json({ error: "Failed to load participant" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    return NextResponse.json({ participant: data }, { status: 200 });
  } catch (err) {
    console.error("World Cup participant route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
