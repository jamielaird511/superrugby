import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

function createServerClient(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.substring(7);
  } else {
    const cookies = req.headers.get("cookie") || "";
    const cookieMatch = cookies.match(/sb-[^=]+-auth-token=([^;]+)/);
    if (cookieMatch) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(cookieMatch[1]));
        accessToken = sessionData?.access_token || null;
      } catch {
        accessToken = decodeURIComponent(cookieMatch[1]);
      }
    }
  }

  const client = createClient(supabaseUrl || "", supabaseAnonKey || "", {
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
  });

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

    const supabase = createServerClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    if (!user.email || !adminEmails.includes(user.email)) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Base competitions
    const { data: competitionsData, error: competitionsError } = await supabaseAdmin
      .from("competitions")
      .select("id, competition_code, name, sport, season")
      .order("season", { ascending: true })
      .order("competition_code", { ascending: true });

    if (competitionsError) {
      console.error("Error fetching competitions:", competitionsError);
      return NextResponse.json(
        { error: competitionsError.message || "Failed to fetch competitions" },
        { status: 500 }
      );
    }

    const competitionIds = (competitionsData || []).map((c) => c.id);

    // If no competitions, we can short-circuit
    if (!competitionIds.length) {
      return NextResponse.json({ competitions: [], leagues: [] });
    }

    // League counts per competition (compute in JS)
    const { data: leaguesForCounts, error: leaguesForCountsError } = await supabaseAdmin
      .from("leagues")
      .select("id, competition_id")
      .in("competition_id", competitionIds);

    if (leaguesForCountsError) {
      console.error("Error fetching leagues for counts:", leaguesForCountsError);
      return NextResponse.json(
        { error: leaguesForCountsError.message || "Failed to fetch league counts" },
        { status: 500 }
      );
    }

    const leagueCountsMap = new Map<string, number>();
    (leaguesForCounts || []).forEach((row: any) => {
      const compId = row.competition_id as string;
      leagueCountsMap.set(compId, (leagueCountsMap.get(compId) || 0) + 1);
    });

    // Round counts per competition (compute in JS)
    const { data: roundsForCounts, error: roundsForCountsError } = await supabaseAdmin
      .from("rounds")
      .select("id, competition_id")
      .in("competition_id", competitionIds);

    if (roundsForCountsError) {
      console.error("Error fetching rounds for counts:", roundsForCountsError);
      return NextResponse.json(
        { error: roundsForCountsError.message || "Failed to fetch round counts" },
        { status: 500 }
      );
    }

    const roundCountsMap = new Map<string, number>();
    (roundsForCounts || []).forEach((row: any) => {
      const compId = row.competition_id as string;
      roundCountsMap.set(compId, (roundCountsMap.get(compId) || 0) + 1);
    });

    // Fixture counts per competition (compute in JS)
    const { data: fixturesForCounts, error: fixturesForCountsError } = await supabaseAdmin
      .from("fixtures")
      .select("id, competition_id")
      .in("competition_id", competitionIds);

    if (fixturesForCountsError) {
      console.error("Error fetching fixtures for counts:", fixturesForCountsError);
      return NextResponse.json(
        { error: fixturesForCountsError.message || "Failed to fetch fixture counts" },
        { status: 500 }
      );
    }

    const fixtureCountsMap = new Map<string, number>();
    (fixturesForCounts || []).forEach((row: any) => {
      const compId = row.competition_id as string;
      fixtureCountsMap.set(compId, (fixtureCountsMap.get(compId) || 0) + 1);
    });

    const competitions = (competitionsData || []).map((c) => ({
      id: c.id,
      competition_code: c.competition_code,
      name: c.name,
      sport: c.sport,
      season: c.season,
      leagues_count: leagueCountsMap.get(c.id) || 0,
      rounds_count: roundCountsMap.get(c.id) || 0,
      fixtures_count: fixtureCountsMap.get(c.id) || 0,
    }));

    // Base leagues
    const { data: leaguesData, error: leaguesError } = await supabaseAdmin
      .from("leagues")
      .select("id, league_code, name, competition_id, created_at")
      .order("league_code", { ascending: true });

    if (leaguesError) {
      console.error("Error fetching leagues:", leaguesError);
      return NextResponse.json(
        { error: leaguesError.message || "Failed to fetch leagues" },
        { status: 500 }
      );
    }

    const leagueIds = (leaguesData || []).map((l) => l.id);

    // Participant counts per league (compute in JS)
    const { data: participantsForCounts, error: participantsForCountsError } = await supabaseAdmin
      .from("participants")
      .select("id, league_id")
      .in("league_id", leagueIds);

    if (participantsForCountsError) {
      console.error("Error fetching participant counts:", participantsForCountsError);
      return NextResponse.json(
        { error: participantsForCountsError.message || "Failed to fetch participant counts" },
        { status: 500 }
      );
    }

    const participantCountsMap = new Map<string, number>();
    (participantsForCounts || []).forEach((row: any) => {
      const leagueId = row.league_id as string;
      participantCountsMap.set(leagueId, (participantCountsMap.get(leagueId) || 0) + 1);
    });

    const competitionsMap = new Map<string, { competition_code: string }>(
      (competitionsData || []).map((c) => [c.id as string, { competition_code: c.competition_code }])
    );

    const leagues = (leaguesData || []).map((l) => ({
      id: l.id,
      league_code: l.league_code,
      name: l.name,
      competition_id: l.competition_id,
      competition_code: competitionsMap.get(l.competition_id)?.competition_code ?? null,
      participants_count: participantCountsMap.get(l.id) || 0,
      created_at: l.created_at,
    }));

    return NextResponse.json({ competitions, leagues });
  } catch (err) {
    console.error("Admin structure GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

