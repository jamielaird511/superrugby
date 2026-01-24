import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get("participantId");

    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required" },
        { status: 400 }
      );
    }

    // Fetch pick events for this participant
    const { data, error } = await supabaseAdmin
      .from("pick_events")
      .select("id, participant_id, fixture_id, picked_team, margin, created_at")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching pick events:", error);
      return NextResponse.json(
        { error: "Failed to fetch pick events" },
        { status: 500 }
      );
    }

    return NextResponse.json({ events: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Get pick events error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
