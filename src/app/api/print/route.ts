import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: "NO_PARTICIPANT" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");
    const participantId = searchParams.get("participantId") || searchParams.get("teamId");

    if (!roundId || !participantId) {
      return NextResponse.json(
        { error: "roundId and participantId (or teamId) are required" },
        { status: 400 }
      );
    }

    // Verify that the requested participantId matches the authenticated participant's id
    if (participantId !== participant.id) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Fetch fixtures for this round to get fixture IDs
    const { data: fixtures, error: fixturesError } = await supabase
      .from("fixtures")
      .select("id")
      .eq("round_id", roundId);

    if (fixturesError) {
      console.error("Error fetching fixtures:", fixturesError);
      return NextResponse.json(
        { error: "Failed to fetch fixtures" },
        { status: 500 }
      );
    }

    const fixtureIds = (fixtures || []).map((f) => f.id);

    if (fixtureIds.length === 0) {
      return NextResponse.json({ picks: [] }, { status: 200 });
    }

    // Query picks for this participant and round (using non-admin client so RLS applies)
    const { data, error } = await supabase
      .from("picks")
      .select("fixture_id, picked_team, margin")
      .eq("participant_id", participantId)
      .in("fixture_id", fixtureIds);

    if (error) {
      console.error("Error fetching picks:", error);
      return NextResponse.json(
        { error: "Failed to fetch picks" },
        { status: 500 }
      );
    }

    return NextResponse.json({ picks: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Get print picks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
