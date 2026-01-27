import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a server Supabase client using ANON key + request cookies/session (NOT service role)
// This ensures RLS policies are enforced based on the authenticated user
function createServerClient(req: NextRequest) {
  // Extract access token from Authorization header or cookies
  const authHeader = req.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  } else {
    // Try to extract from cookies (Supabase stores session in cookies)
    const cookies = req.headers.get("cookie") || "";
    // Look for Supabase auth token cookie pattern: sb-<project>-auth-token
    const cookieMatch = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
    if (cookieMatch) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(cookieMatch[1]));
        accessToken = sessionData?.access_token || null;
      } catch {
        // If parsing fails, try direct cookie value
        accessToken = decodeURIComponent(cookieMatch[1]);
      }
    }
  }

  // Create client with anon key (RLS will be enforced)
  const client = createClient(
    supabaseUrl || "",
    supabaseAnonKey || "",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
          cookie: req.headers.get("cookie") || "",
        },
      },
    }
  );

  return client;
}

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    // Create server client with user session (not service role)
    const supabase = createServerClient(req);

    // Require an authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // Fetch the participant row for this user
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id, league_id")
      .eq("auth_user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "NO_PARTICIPANT" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedParticipantId = searchParams.get("participantId");

    // participantId from query param is not trusted - we only use the authenticated participant's id
    // If the request includes participantId and it does NOT equal the participant.id -> return 403
    if (requestedParticipantId && requestedParticipantId !== participant.id) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Query picks ONLY for participant.id and their league - using non-admin client so RLS applies
    const { data, error } = await supabase
      .from("picks")
      .select("fixture_id, picked_team, margin")
      .eq("participant_id", participant.id)
      .eq("league_id", participant.league_id);

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

    // Create server client with user session (not service role)
    const supabase = createServerClient(req);

    // Require an authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // Fetch participant row for this user (their real participant id)
    const { data: me, error: meErr } = await supabase
      .from("participants")
      .select("id, league_id")
      .eq("auth_user_id", user.id)
      .single();

    if (meErr || !me) {
      return NextResponse.json(
        { error: "NO_PARTICIPANT" },
        { status: 403 }
      );
    }

    const DRAW_CODE = "DRAW";

    const body = await req.json();
    const { participantId: requestedParticipantId, fixtureId, pickedTeamCode, pickedMargin } = body;
    const participantId = me.id;

    // Stop trusting participantId from body - if they send one and it doesn't match, explicitly forbid
    if (requestedParticipantId && requestedParticipantId !== me.id) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (!fixtureId || !pickedTeamCode || pickedMargin === undefined) {
      return NextResponse.json(
        { error: "fixtureId, pickedTeamCode, and pickedMargin are required" },
        { status: 400 }
      );
    }

    // Enforce the new margin encoding: DRAW=0, non-DRAW must be 1 or 13
    let margin = 0;

    if (pickedTeamCode === DRAW_CODE) {
      margin = 0;
    } else {
      margin = Number(pickedMargin);
      if (!Number.isInteger(margin) || (margin !== 1 && margin !== 13)) {
        return NextResponse.json(
          { error: "pickedMargin must be 1 (1-12) or 13 (13+) for non-DRAW picks" },
          { status: 400 }
        );
      }
    }

    // Look up competition_id for this participant's league
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("competition_id")
      .eq("id", me.league_id)
      .single();

    if (leagueError || !league) {
      console.error("Error fetching league for picks:", leagueError);
      return NextResponse.json(
        { error: "League not found for participant" },
        { status: 500 }
      );
    }

    const competitionId = league.competition_id;

    // Fetch fixture to validate lockout and team codes, and verify competition matches
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, home_team_code, away_team_code, competition_id")
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

    // Verify fixture belongs to the same competition as the participant's league
    if (fixture.competition_id !== competitionId) {
      return NextResponse.json(
        { error: "Fixture does not belong to your competition" },
        { status: 403 }
      );
    }

    // If a result already exists for this fixture, picks are permanently locked
    const { data: existingResult, error: resultError } = await supabaseAdmin
      .from("results")
      .select("fixture_id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();

    if (resultError) {
      console.error("Error checking existing result for fixture:", {
        message: resultError?.message,
        details: resultError?.details,
        hint: resultError?.hint,
        code: resultError?.code,
        raw: resultError,
      });
      return NextResponse.json(
        { error: "Failed to validate fixture lock state" },
        { status: 500 }
      );
    }

    if (existingResult) {
      return NextResponse.json(
        { error: "Fixture is locked (final result recorded)" },
        { status: 403 }
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

    // Log pick event before upserting
    const { error: eventError } = await supabaseAdmin
      .from("pick_events")
      .insert({
        auth_user_id: user.id,
        participant_id: participantId,
        fixture_id: fixtureId,
        picked_team: pickedTeamCode,
        margin: margin,
      });

    if (eventError) {
      console.error("Error logging pick event:", {
        message: eventError?.message,
        details: eventError?.details,
        hint: eventError?.hint,
        code: eventError?.code,
        raw: eventError,
      });
      return NextResponse.json(
        { error: eventError?.message || "Failed to log pick event" },
        { status: 500 }
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
          league_id: me.league_id,
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
