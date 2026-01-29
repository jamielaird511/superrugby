import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DRAW_CODE = "DRAW";

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
      headers: {
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        cookie: req.headers.get("cookie") || "",
      },
    },
  });
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => ({}));
    const participant_id = body.participant_id;
    const round_id = body.round_id;

    if (typeof participant_id !== "string" || !UUID_REGEX.test(participant_id)) {
      return NextResponse.json({ error: "participant_id must be a valid UUID" }, { status: 400 });
    }

    const { data: participant, error: partErr } = await supabaseAdmin
      .from("participants")
      .select("id, league_id")
      .eq("id", participant_id)
      .single();
    if (partErr || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    let picks: { fixture_id: string; picked_team: string; margin: number }[];
    const fixturesById: Record<string, { id: string; home_team_code: string | null; away_team_code: string | null }> = {};

    if (round_id && typeof round_id === "string" && UUID_REGEX.test(round_id)) {
      const { data: roundFixtures, error: fixErr } = await supabaseAdmin
        .from("fixtures")
        .select("id, home_team_code, away_team_code")
        .eq("round_id", round_id);
      if (fixErr || !roundFixtures?.length) {
        return NextResponse.json({ ok: true, upsertedCount: 0, skippedFixtureIds: [] }, { status: 200 });
      }
      roundFixtures.forEach((f) => {
        fixturesById[f.id] = { id: f.id, home_team_code: f.home_team_code ?? null, away_team_code: f.away_team_code ?? null };
      });
      const fixtureIds = roundFixtures.map((f) => f.id);
      const { data: picksData, error: picksErr } = await supabaseAdmin
        .from("picks")
        .select("fixture_id, picked_team, margin")
        .eq("participant_id", participant_id)
        .eq("league_id", participant.league_id)
        .in("fixture_id", fixtureIds);
      if (picksErr) {
        console.error("Sync paper bets: picks fetch error", picksErr);
        return NextResponse.json({ error: picksErr.message || "Failed to fetch picks" }, { status: 500 });
      }
      picks = picksData || [];
    } else {
      const { data: picksData, error: picksErr } = await supabaseAdmin
        .from("picks")
        .select("fixture_id, picked_team, margin")
        .eq("participant_id", participant_id)
        .eq("league_id", participant.league_id);
      if (picksErr) {
        console.error("Sync paper bets: picks fetch error", picksErr);
        return NextResponse.json({ error: picksErr.message || "Failed to fetch picks" }, { status: 500 });
      }
      picks = picksData || [];
    }

    const skippedFixtureIds: string[] = [];
    let upsertedCount = 0;

    for (const pick of picks) {
      let fixture = fixturesById[pick.fixture_id];
      if (!fixture) {
        const { data: f, error: fixErr } = await supabaseAdmin
          .from("fixtures")
          .select("id, home_team_code, away_team_code")
          .eq("id", pick.fixture_id)
          .single();
        if (fixErr || !f) {
          skippedFixtureIds.push(pick.fixture_id);
          continue;
        }
        fixture = { id: f.id, home_team_code: f.home_team_code ?? null, away_team_code: f.away_team_code ?? null };
        fixturesById[pick.fixture_id] = fixture;
      }

      let outcome: string | null = null;
      if (pick.picked_team === DRAW_CODE) {
        outcome = "draw";
      } else if (fixture.home_team_code && pick.picked_team === fixture.home_team_code && pick.margin === 1) {
        outcome = "home_1_12";
      } else if (fixture.home_team_code && pick.picked_team === fixture.home_team_code && pick.margin === 13) {
        outcome = "home_13_plus";
      } else if (fixture.away_team_code && pick.picked_team === fixture.away_team_code && pick.margin === 1) {
        outcome = "away_1_12";
      } else if (fixture.away_team_code && pick.picked_team === fixture.away_team_code && pick.margin === 13) {
        outcome = "away_13_plus";
      }

      if (!outcome) {
        skippedFixtureIds.push(pick.fixture_id);
        continue;
      }

      const { data: oddsRow, error: oddsErr } = await supabaseAdmin
        .from("match_odds")
        .select("draw_odds, home_1_12_odds, home_13_plus_odds, away_1_12_odds, away_13_plus_odds")
        .eq("fixture_id", pick.fixture_id)
        .maybeSingle();
      if (oddsErr || !oddsRow) {
        skippedFixtureIds.push(pick.fixture_id);
        continue;
      }

      const oddsByOutcome: Record<string, number> = {
        draw: oddsRow.draw_odds,
        home_1_12: oddsRow.home_1_12_odds,
        home_13_plus: oddsRow.home_13_plus_odds,
        away_1_12: oddsRow.away_1_12_odds,
        away_13_plus: oddsRow.away_13_plus_odds,
      };
      const oddsValue = oddsByOutcome[outcome];
      if (oddsValue == null || typeof oddsValue !== "number" || Number(oddsValue) < 1.01) {
        skippedFixtureIds.push(pick.fixture_id);
        continue;
      }

      const { error: betErr } = await supabaseAdmin
        .from("paper_bets")
        .upsert(
          {
            participant_id,
            fixture_id: pick.fixture_id,
            league_id: participant.league_id,
            outcome,
            stake: 10,
            odds: Number(oddsValue),
          },
          { onConflict: "participant_id,fixture_id" }
        );
      if (betErr) {
        console.error("[Sync paper bets] upsert failed", pick.fixture_id, betErr);
        skippedFixtureIds.push(pick.fixture_id);
      } else {
        upsertedCount += 1;
      }
    }

    return NextResponse.json({ ok: true, upsertedCount, skippedFixtureIds }, { status: 200 });
  } catch (err) {
    console.error("Sync paper bets error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
