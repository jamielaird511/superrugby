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

    // Validate participantId is a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(participantId)) {
      return NextResponse.json(
        { error: "participantId must be a valid UUID" },
        { status: 400 }
      );
    }

    // Fetch picks for this participant
    const { data, error } = await supabaseAdmin
      .from("picks")
      .select("fixture_id, picked_team, margin")
      .eq("participant_id", participantId);

    if (error) {
      console.error("Error fetching picks:", error);
      return NextResponse.json(
        { error: "Failed to fetch picks" },
        { status: 500 }
      );
    }

    return NextResponse.json({ picks: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Get picks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const DRAW_CODE = "DRAW";

    const body = await req.json();
    const { participantId, fixtureId, pickedTeamCode, pickedMargin } = body;

    if (!participantId || !fixtureId || !pickedTeamCode || pickedMargin === undefined) {
      return NextResponse.json(
        { error: "participantId, fixtureId, pickedTeamCode, and pickedMargin are required" },
        { status: 400 }
      );
    }

    // If Draw is selected, force margin to 0
    let margin = 0;
    if (pickedTeamCode === DRAW_CODE) {
      margin = 0;
    } else {
      // Validate margin is an integer >= 0
      margin = Number(pickedMargin);
      if (isNaN(margin) || !Number.isInteger(margin) || margin < 0) {
        return NextResponse.json(
          { error: "pickedMargin must be a non-negative integer" },
          { status: 400 }
        );
      }
    }

    // Fetch fixture to validate lockout and team codes
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, home_team_code, away_team_code")
      .eq("id", fixtureId)
      .single();

    if (fixtureError || !fixture) {
      if (fixtureError) {
        console.error("Error fetching fixture:", {
          message: fixtureError?.message,
          details: fixtureError?.details,
          hint: fixtureError?.hint,
          code: fixtureError?.code,
          raw: fixtureError,
        });
        return NextResponse.json(
          {
            error: "Fixture not found",
            supabase: {
              message: fixtureError?.message,
              details: fixtureError?.details,
              hint: fixtureError?.hint,
              code: fixtureError?.code,
            },
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Fixture not found" },
        { status: 404 }
      );
    }

    // Check if fixture is locked (kickoff has passed)
    if (fixture.kickoff_at) {
      const kickoffTime = new Date(fixture.kickoff_at);
      const now = new Date();
      if (now >= kickoffTime) {
        return NextResponse.json(
          { error: "Fixture is locked" },
          { status: 403 }
        );
      }
    }

    // Validate picked_team_code matches home or away team, or is DRAW
    if (
      pickedTeamCode !== fixture.home_team_code &&
      pickedTeamCode !== fixture.away_team_code &&
      pickedTeamCode !== DRAW_CODE
    ) {
      return NextResponse.json(
        { error: "pickedTeamCode must match home_team_code, away_team_code, or be DRAW for this fixture" },
        { status: 400 }
      );
    }

    // Check if pick exists
    const { data: existingPick } = await supabaseAdmin
      .from("picks")
      .select("id")
      .eq("participant_id", participantId)
      .eq("fixture_id", fixtureId)
      .maybeSingle();

    if (existingPick) {
      // Update existing pick (updated_at is handled by trigger)
      const { error: updateError } = await supabaseAdmin
        .from("picks")
        .update({
          picked_team: pickedTeamCode,
          margin: margin,
        })
        .eq("id", existingPick.id);

      if (updateError) {
        console.error("Error updating pick:", {
          message: updateError?.message,
          details: updateError?.details,
          hint: updateError?.hint,
          code: updateError?.code,
          raw: updateError,
        });
        return NextResponse.json(
          {
            error: "Failed to update pick",
            supabase: {
              message: updateError?.message,
              details: updateError?.details,
              hint: updateError?.hint,
              code: updateError?.code,
            },
          },
          { status: 500 }
        );
      }
    } else {
      // Insert new pick
      const { error: insertError } = await supabaseAdmin
        .from("picks")
        .insert({
          participant_id: participantId,
          fixture_id: fixtureId,
          picked_team: pickedTeamCode,
          margin: margin,
        });

      if (insertError) {
        console.error("Error inserting pick:", {
          message: insertError?.message,
          details: insertError?.details,
          hint: insertError?.hint,
          code: insertError?.code,
          raw: insertError,
        });
        return NextResponse.json(
          {
            error: "Failed to save pick",
            supabase: {
              message: insertError?.message,
              details: insertError?.details,
              hint: insertError?.hint,
              code: insertError?.code,
            },
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { ok: true },
      { status: 200 }
    );
  } catch (err) {
    console.error("Post picks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
