import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin email allowlist
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.includes(userEmailLower)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get roundId from query params
    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");

    if (!roundId) {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 });
    }

    // Load fixtures for the round
    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, round_id, match_number, home_team_code, away_team_code, kickoff_at")
      .eq("round_id", roundId)
      .order("kickoff_at", { ascending: true });

    if (fixturesError) {
      console.error("Error fetching fixtures:", fixturesError);
      return NextResponse.json(
        { error: "Failed to fetch fixtures" },
        { status: 500 }
      );
    }

    const fixtureIds = (fixtures || []).map((f) => f.id);

    // Load participants
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name, business_name")
      .order("team_name", { ascending: true });

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return NextResponse.json(
        { error: "Failed to fetch participants" },
        { status: 500 }
      );
    }

    // Load picks for those fixtures
    let picks: unknown[] = [];
    if (fixtureIds.length > 0) {
      const { data: picksData, error: picksError } = await supabaseAdmin
        .from("picks")
        .select("id, participant_id, fixture_id, picked_team, margin, created_at, updated_at")
        .in("fixture_id", fixtureIds);

      if (picksError) {
        console.error("Error fetching picks:", picksError);
        return NextResponse.json(
          { error: "Failed to fetch picks" },
          { status: 500 }
        );
      }

      picks = picksData || [];
    }

    // Load results for those fixtures
    let results: unknown[] = [];
    if (fixtureIds.length > 0) {
      const { data: resultsData, error: resultsError } = await supabaseAdmin
        .from("results")
        .select("fixture_id, winning_team, margin_band")
        .in("fixture_id", fixtureIds);

      if (resultsError) {
        console.error("Error fetching results:", resultsError);
        return NextResponse.json(
          { error: "Failed to fetch results" },
          { status: 500 }
        );
      }

      results = resultsData || [];
    }

    // Load super_rugby_teams for mapping
    const { data: superRugbyTeams, error: teamsError } = await supabaseAdmin
      .from("super_rugby_teams")
      .select("*");

    if (teamsError) {
      console.error("Error fetching teams:", teamsError);
      return NextResponse.json(
        { error: "Failed to fetch teams" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fixtures: fixtures || [],
      participants: participants || [],
      picks: picks,
      results: results,
      superRugbyTeams: superRugbyTeams || [],
    });
  } catch (err) {
    console.error("Admin picks-view API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
