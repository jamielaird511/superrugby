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

    const body = await req.json();
    const { participant_id, fixture_id, picked_team_code, margin, action } = body;

    if (typeof participant_id !== "string" || !UUID_REGEX.test(participant_id)) {
      return NextResponse.json({ error: "participant_id must be a valid UUID" }, { status: 400 });
    }
    if (typeof fixture_id !== "string" || !UUID_REGEX.test(fixture_id)) {
      return NextResponse.json({ error: "fixture_id must be a valid UUID" }, { status: 400 });
    }
    if (action !== "upsert" && action !== "delete") {
      return NextResponse.json({ error: "action must be 'upsert' or 'delete'" }, { status: 400 });
    }

    if (action === "upsert") {
      if (!picked_team_code || margin === undefined) {
        return NextResponse.json({ error: "picked_team_code and margin are required for upsert" }, { status: 400 });
      }
      const marginNum = Number(margin);
      if (picked_team_code === DRAW_CODE) {
        if (marginNum !== 0) {
          return NextResponse.json({ error: "margin must be 0 for DRAW" }, { status: 400 });
        }
      } else {
        if (!Number.isInteger(marginNum) || (marginNum !== 1 && marginNum !== 13)) {
          return NextResponse.json({ error: "margin must be 1 or 13 for non-DRAW" }, { status: 400 });
        }
      }
    }

    const { data: participant, error: partErr } = await supabaseAdmin
      .from("participants")
      .select("id, league_id")
      .eq("id", participant_id)
      .single();
    if (partErr || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("competition_id")
      .eq("id", participant.league_id)
      .single();
    if (leagueError || !league) {
      return NextResponse.json({ error: "League not found" }, { status: 500 });
    }

    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, home_team_code, away_team_code, competition_id")
      .eq("id", fixture_id)
      .single();
    if (fixtureError || !fixture) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }
    if (fixture.competition_id !== league.competition_id) {
      return NextResponse.json({ error: "Fixture does not belong to participant's competition" }, { status: 403 });
    }

    const { data: existingResult, error: resultError } = await supabaseAdmin
      .from("results")
      .select("fixture_id")
      .eq("fixture_id", fixture_id)
      .maybeSingle();
    if (resultError) {
      return NextResponse.json({ error: "Failed to check fixture lock" }, { status: 500 });
    }
    if (existingResult) {
      return NextResponse.json({ error: "Fixture is locked (result recorded)" }, { status: 403 });
    }

    if (fixture.kickoff_at) {
      const kickoffTime = new Date(fixture.kickoff_at);
      if (new Date() >= kickoffTime) {
        return NextResponse.json({ error: "Fixture is locked (kickoff passed)" }, { status: 403 });
      }
    }

    if (action === "upsert") {
      if (
        picked_team_code !== fixture.home_team_code &&
        picked_team_code !== fixture.away_team_code &&
        picked_team_code !== DRAW_CODE
      ) {
        return NextResponse.json({ error: "picked_team_code must be home, away, or DRAW for this fixture" }, { status: 400 });
      }

      const marginVal = picked_team_code === DRAW_CODE ? 0 : Number(margin);

      const { data: existingPick } = await supabaseAdmin
        .from("picks")
        .select("id")
        .eq("participant_id", participant_id)
        .eq("fixture_id", fixture_id)
        .maybeSingle();

      if (existingPick) {
        const { error: updateErr } = await supabaseAdmin
          .from("picks")
          .update({ picked_team: picked_team_code, margin: marginVal })
          .eq("id", existingPick.id);
        if (updateErr) {
          console.error("Override pick update error:", updateErr);
          return NextResponse.json({ error: updateErr.message || "Failed to update pick" }, { status: 500 });
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from("picks")
          .insert({
            participant_id,
            fixture_id,
            league_id: participant.league_id,
            picked_team: picked_team_code,
            margin: marginVal,
          });
        if (insertErr) {
          console.error("Override pick insert error:", insertErr);
          return NextResponse.json({ error: insertErr.message || "Failed to insert pick" }, { status: 500 });
        }
      }

      try {
        let outcome: string | null = null;
        if (picked_team_code === DRAW_CODE) outcome = "draw";
        else if (picked_team_code === fixture.home_team_code && marginVal === 1) outcome = "home_1_12";
        else if (picked_team_code === fixture.home_team_code && marginVal === 13) outcome = "home_13_plus";
        else if (picked_team_code === fixture.away_team_code && marginVal === 1) outcome = "away_1_12";
        else if (picked_team_code === fixture.away_team_code && marginVal === 13) outcome = "away_13_plus";

        if (outcome) {
          const { data: oddsRow, error: oddsErr } = await supabaseAdmin
            .from("match_odds")
            .select("draw_odds, home_1_12_odds, home_13_plus_odds, away_1_12_odds, away_13_plus_odds")
            .eq("fixture_id", fixture_id)
            .maybeSingle();
          if (!oddsErr && oddsRow) {
            const oddsByOutcome: Record<string, number> = {
              draw: oddsRow.draw_odds,
              home_1_12: oddsRow.home_1_12_odds,
              home_13_plus: oddsRow.home_13_plus_odds,
              away_1_12: oddsRow.away_1_12_odds,
              away_13_plus: oddsRow.away_13_plus_odds,
            };
            const oddsValue = oddsByOutcome[outcome];
            if (oddsValue != null && typeof oddsValue === "number" && oddsValue >= 1.01) {
              const { error: betErr } = await supabaseAdmin
                .from("paper_bets")
                .upsert(
                  {
                    participant_id,
                    fixture_id,
                    league_id: participant.league_id,
                    outcome,
                    stake: 10,
                    odds: Number(oddsValue),
                  },
                  { onConflict: "participant_id,fixture_id" }
                );
              if (betErr) console.error("[Override] paper_bets upsert failed", betErr);
            }
          }
        }
      } catch (e) {
        console.error("[Override] paper_bets sync error", e);
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (action === "delete") {
      const { error: delPickErr } = await supabaseAdmin
        .from("picks")
        .delete()
        .eq("participant_id", participant_id)
        .eq("fixture_id", fixture_id);
      if (delPickErr) {
        console.error("Override pick delete error:", delPickErr);
        return NextResponse.json({ error: delPickErr.message || "Failed to delete pick" }, { status: 500 });
      }

      try {
        await supabaseAdmin
          .from("paper_bets")
          .delete()
          .eq("participant_id", participant_id)
          .eq("fixture_id", fixture_id);
      } catch (e) {
        console.error("[Override] paper_bets delete error", e);
      }

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Override pick error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
