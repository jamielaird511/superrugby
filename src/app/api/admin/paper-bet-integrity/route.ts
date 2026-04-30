import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSuperRugbyAdminCompetitionId } from "@/lib/superRugbyAdminScope";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return createClient(supabaseUrl || "", supabaseAnonKey || "", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { ...(accessToken && { Authorization: `Bearer ${accessToken}` }), cookie: req.headers.get("cookie") || "" },
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }
    const supabase = createServerClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.length || !userEmailLower || !adminEmails.includes(userEmailLower)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId")?.trim() || null;
    const empty = {
      missingPaperBets: 0,
      fixturesWithoutOdds: 0,
      paperBetsMissingKickoffOdds: 0,
      affectedParticipants: 0,
    };
    if (!roundId || !UUID_REGEX.test(roundId)) {
      return NextResponse.json(empty);
    }

    const srCompId = await getSuperRugbyAdminCompetitionId(supabaseAdmin);
    if (!srCompId) {
      return NextResponse.json(empty);
    }

    const { data: srRound } = await supabaseAdmin
      .from("rounds")
      .select("id")
      .eq("id", roundId)
      .eq("competition_id", srCompId)
      .maybeSingle();
    if (!srRound) {
      return NextResponse.json(empty);
    }

    const { data: fixtures, error: fixErr } = await supabaseAdmin
      .from("fixtures")
      .select("id")
      .eq("round_id", roundId)
      .eq("competition_id", srCompId);
    if (fixErr || !fixtures?.length) {
      return NextResponse.json(empty);
    }
    const fixtureIds = fixtures.map((f) => f.id);

    const [picksRes, paperRes, oddsRes, paperWithOddsRes] = await Promise.all([
      supabaseAdmin.from("picks").select("participant_id, fixture_id").in("fixture_id", fixtureIds),
      supabaseAdmin.from("paper_bets").select("participant_id, fixture_id").in("fixture_id", fixtureIds),
      supabaseAdmin.from("match_odds").select("fixture_id").in("fixture_id", fixtureIds),
      supabaseAdmin.from("paper_bets").select("participant_id, fixture_id, kickoff_odds").in("fixture_id", fixtureIds),
    ]);

    const picks = picksRes.data ?? [];
    const paperSet = new Set((paperRes.data ?? []).map((r) => `${r.participant_id}:${r.fixture_id}`));
    const oddsFixtureIds = new Set((oddsRes.data ?? []).map((r) => r.fixture_id));

    const fixturesWithoutOdds = fixtureIds.filter((id) => !oddsFixtureIds.has(id)).length;

    let missingPaperBets = 0;
    const affectedParticipantIds = new Set<string>();

    for (const p of picks) {
      const key = `${p.participant_id}:${p.fixture_id}`;
      if (!paperSet.has(key)) {
        missingPaperBets++;
        affectedParticipantIds.add(p.participant_id);
      }
    }

    let paperBetsMissingKickoffOdds = 0;
    const paperWithOdds = paperWithOddsRes.data ?? [];
    for (const row of paperWithOdds) {
      const r = row as { participant_id?: string; fixture_id?: string; kickoff_odds?: unknown };
      if (r.kickoff_odds == null) {
        paperBetsMissingKickoffOdds++;
        if (r.participant_id) affectedParticipantIds.add(r.participant_id);
      }
    }

    return NextResponse.json({
      missingPaperBets,
      fixturesWithoutOdds,
      paperBetsMissingKickoffOdds,
      affectedParticipants: affectedParticipantIds.size,
    });
  } catch (err) {
    console.error("Paper bet integrity error:", err);
    return NextResponse.json({ error: "Failed to load integrity stats" }, { status: 500 });
  }
}
