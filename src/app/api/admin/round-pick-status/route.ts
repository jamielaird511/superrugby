import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.includes(userEmailLower)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");

    if (!roundId || roundId.trim() === "") {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 });
    }

    // 1) Fetch round with competition_id
    const { data: round, error: roundError } = await supabaseAdmin
      .from("rounds")
      .select("id, competition_id, season, round_number")
      .eq("id", roundId)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const competitionId = round.competition_id;
    if (!competitionId) {
      return NextResponse.json({ error: "Round has no competition_id" }, { status: 400 });
    }

    // 2) Fetch fixtures in that round (scoped by competition)
    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at")
      .eq("round_id", roundId)
      .eq("competition_id", competitionId);

    if (fixturesError) {
      return NextResponse.json({ error: fixturesError.message || "Failed to fetch fixtures" }, { status: 500 });
    }

    const allFixtures = fixtures || [];
    const totalGames = allFixtures.length;
    const now = new Date().toISOString();
    const openFixtureIds = allFixtures
      .filter((f: { kickoff_at: string | null }) => !f.kickoff_at || f.kickoff_at > now)
      .map((f: { id: string }) => f.id);
    const openGames = openFixtureIds.length;

    // 3) Fetch leagues for this competition
    const { data: leagues, error: leaguesError } = await supabaseAdmin
      .from("leagues")
      .select("id")
      .eq("competition_id", competitionId);

    if (leaguesError || !leagues?.length) {
      return NextResponse.json({
        round: { id: round.id, season: round.season, round_number: round.round_number },
        totals: { total_games: totalGames, open_games: openGames, participant_count: 0, complete_open_count: 0, incomplete_open_count: 0 },
        rows: [],
      });
    }

    const leagueIds = leagues.map((l: { id: string }) => l.id);

    // 4) Fetch participants for those leagues
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name")
      .in("league_id", leagueIds)
      .order("team_name", { ascending: true });

    if (participantsError || !participants?.length) {
      return NextResponse.json({
        round: { id: round.id, season: round.season, round_number: round.round_number },
        totals: { total_games: totalGames, open_games: openGames, participant_count: 0, complete_open_count: 0, incomplete_open_count: 0 },
        rows: [],
      });
    }

    const participantIds = participants.map((p: { id: string }) => p.id);
    const fixtureIds = allFixtures.map((f: { id: string }) => f.id);

    // 5) Fetch picks for those participants and fixtures
    let picks: { participant_id: string; fixture_id: string }[] = [];
    if (fixtureIds.length > 0) {
      const { data: picksData, error: picksError } = await supabaseAdmin
        .from("picks")
        .select("participant_id, fixture_id")
        .in("fixture_id", fixtureIds)
        .in("participant_id", participantIds);

      if (!picksError && picksData) {
        picks = picksData;
      }
    }

    // 6) Fetch participant emails
    const { data: contactsData } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id, email")
      .in("participant_id", participantIds);

    const emailsByParticipant = new Map<string, string[]>();
    (contactsData || []).forEach((c: { participant_id: string; email: string }) => {
      if (!emailsByParticipant.has(c.participant_id)) {
        emailsByParticipant.set(c.participant_id, []);
      }
      const arr = emailsByParticipant.get(c.participant_id)!;
      if (c.email && !arr.includes(c.email)) arr.push(c.email);
    });

    // 7) Build rows
    const picksByParticipant = new Map<string, Set<string>>();
    picks.forEach((p) => {
      if (!picksByParticipant.has(p.participant_id)) {
        picksByParticipant.set(p.participant_id, new Set());
      }
      picksByParticipant.get(p.participant_id)!.add(p.fixture_id);
    });

    const rows: {
      participant_id: string;
      team_name: string;
      picks_total: number;
      picks_open: number;
      total_games: number;
      open_games: number;
      missing_open: number;
      is_complete_open: boolean;
      emails: string[];
    }[] = [];

    let completeOpenCount = 0;
    let incompleteOpenCount = 0;

    participants.forEach((p: { id: string; team_name: string }) => {
      const pickFixtureIds = picksByParticipant.get(p.id) || new Set();
      const picksTotal = Array.from(pickFixtureIds).filter((fid) => fixtureIds.includes(fid)).length;
      const picksOpen = Array.from(pickFixtureIds).filter((fid) => openFixtureIds.includes(fid)).length;
      const missingOpen = Math.max(openGames - picksOpen, 0);
      const isCompleteOpen = openGames > 0 && picksOpen === openGames;

      if (isCompleteOpen) completeOpenCount++;
      else if (missingOpen > 0) incompleteOpenCount++;

      rows.push({
        participant_id: p.id,
        team_name: p.team_name ?? "",
        picks_total: picksTotal,
        picks_open: picksOpen,
        total_games: totalGames,
        open_games: openGames,
        missing_open: missingOpen,
        is_complete_open: isCompleteOpen,
        emails: emailsByParticipant.get(p.id) || [],
      });
    });

    return NextResponse.json({
      round: { id: round.id, season: round.season, round_number: round.round_number },
      totals: {
        total_games: totalGames,
        open_games: openGames,
        participant_count: participants.length,
        complete_open_count: completeOpenCount,
        incomplete_open_count: incompleteOpenCount,
      },
      rows,
    });
  } catch (err) {
    console.error("Admin round-pick-status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
