import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncPaperBetsForFixture } from "@/lib/syncPaperBetsForFixture";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIFA_WORLD_CUP_2026_LEAGUE_ID = "a908c579-842c-43c8-85d3-229b543bb2a3";
const FIFA_WORLD_CUP_2026_COMPETITION_ID = "9e60564e-4be5-4756-b6cb-48ae06f45654";

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

    const { searchParams } = new URL(req.url);
    const requestedParticipantId = searchParams.get("participantId");
    const roundId = searchParams.get("roundId");
    const supabase = createServerClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let participantId = "";
    let participantLeagueId = "";
    let useAdminForQuery = false;

    if (user && !userError) {
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .select("id, league_id")
        .eq("auth_user_id", user.id)
        .single();

      if (participantError || !participant) {
        console.error("[GET /api/picks] participant lookup failed", {
          message: participantError?.message,
          code: (participantError as { code?: string } | null)?.code,
          details: (participantError as { details?: string } | null)?.details,
        });
        return NextResponse.json(
          {
            error: "NO_PARTICIPANT",
            details: participantError?.message || "No participant found for authenticated user",
          },
          { status: 403 }
        );
      }

      if (requestedParticipantId && requestedParticipantId !== participant.id) {
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403 }
        );
      }

      participantId = participant.id;
      participantLeagueId = participant.league_id;
    } else {
      // World Cup flow without Supabase Auth (participant_id in query string)
      if (!requestedParticipantId) {
        return NextResponse.json(
          { error: "UNAUTHENTICATED", details: "participantId is required for this request" },
          { status: 401 }
        );
      }

      const { data: worldCupParticipant, error: wcParticipantError } = await supabaseAdmin
        .from("participants")
        .select("id, league_id")
        .eq("id", requestedParticipantId)
        .maybeSingle();

      if (wcParticipantError || !worldCupParticipant) {
        console.error("[GET /api/picks] world cup participant validation failed", {
          message: wcParticipantError?.message,
          code: (wcParticipantError as { code?: string } | null)?.code,
          details: (wcParticipantError as { details?: string } | null)?.details,
        });
        return NextResponse.json(
          { error: "Invalid participant", details: wcParticipantError?.message || "Participant not found" },
          { status: 400 }
        );
      }

      if (worldCupParticipant.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID) {
        return NextResponse.json(
          { error: "FORBIDDEN" },
          { status: 403 }
        );
      }

      participantId = worldCupParticipant.id;
      participantLeagueId = worldCupParticipant.league_id;
      useAdminForQuery = true;
    }

    let data: { fixture_id: string; picked_team: string; margin: number }[] | null = null;
    let error: { message?: string; code?: string; details?: string } | null = null;

    if (roundId) {
      // Scope to current round: get fixture ids for this round, then picks for those fixtures (DB-level filtering)
      const fixtureClient = useAdminForQuery ? supabaseAdmin : supabase;
      const picksClient = useAdminForQuery ? supabaseAdmin : supabase;
      const { data: fixtureIdsRows, error: fixturesErr } = await fixtureClient
        .from("fixtures")
        .select("id")
        .eq("round_id", roundId);

      if (fixturesErr) {
        console.error("[GET /api/picks] fixture ids by round failed:", {
          message: fixturesErr?.message,
          code: (fixturesErr as { code?: string } | null)?.code,
          details: (fixturesErr as { details?: string } | null)?.details,
        });
        return NextResponse.json(
          { error: "Failed to fetch picks", details: fixturesErr.message || "Could not load fixtures for round" },
          { status: 500 }
        );
      }

      const fixtureIds = (fixtureIdsRows || []).map((r: { id: string }) => r.id);
      if (fixtureIds.length === 0) {
        return NextResponse.json({ picks: [] }, { status: 200 });
      }

      const result = await picksClient
        .from("picks")
        .select("fixture_id, picked_team, margin")
        .eq("participant_id", participantId)
        .eq("league_id", participantLeagueId)
        .in("fixture_id", fixtureIds);

      data = result.data;
      error = result.error;
    } else {
      // Existing behavior: all picks for this participant
      const picksClient = useAdminForQuery ? supabaseAdmin : supabase;
      const result = await picksClient
        .from("picks")
        .select("fixture_id, picked_team, margin")
        .eq("participant_id", participantId)
        .eq("league_id", participantLeagueId);

      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("[GET /api/picks] picks query failed:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        participantId,
        participantLeagueId,
        useAdminForQuery,
      });
      return NextResponse.json(
        { error: "Failed to fetch picks", details: error?.message || "Unknown picks query error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ picks: data || [] }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/picks] unexpected error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
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

    // Create server client with user session (not service role)
    const supabase = createServerClient(req);
    const body = await req.json();
    const { participantId: requestedParticipantId, fixtureId, pickedTeamCode, pickedMargin } = body;

    if (!fixtureId || !pickedTeamCode || pickedMargin === undefined) {
      return NextResponse.json(
        { error: "fixtureId, pickedTeamCode, and pickedMargin are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let participantId = "";
    let participantLeagueId = "";
    let competitionId = "";
    let authUserId: string | null = null;

    if (user) {
      // Existing authenticated flow (Super Rugby + authenticated World Cup users).
      const { data: me, error: meErr } = await supabase
        .from("participants")
        .select("id, league_id")
        .eq("auth_user_id", user.id)
        .single();

      if (meErr || !me) {
        return NextResponse.json({ error: "NO_PARTICIPANT" }, { status: 403 });
      }

      if (requestedParticipantId && requestedParticipantId !== me.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      const { data: league, error: leagueError } = await supabaseAdmin
        .from("leagues")
        .select("competition_id")
        .eq("id", me.league_id)
        .single();

      if (leagueError || !league) {
        console.error("Error fetching league for picks:", leagueError);
        return NextResponse.json({ error: "League not found for participant" }, { status: 500 });
      }

      participantId = me.id;
      participantLeagueId = me.league_id;
      competitionId = league.competition_id;
      authUserId = user.id;
    } else {
      // World Cup flow without Supabase Auth.
      if (!requestedParticipantId) {
        return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
      }

      const { data: worldCupParticipant, error: wcParticipantError } = await supabaseAdmin
        .from("participants")
        .select("id, league_id")
        .eq("id", requestedParticipantId)
        .maybeSingle();

      if (wcParticipantError || !worldCupParticipant) {
        return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
      }

      if (worldCupParticipant.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      participantId = worldCupParticipant.id;
      participantLeagueId = worldCupParticipant.league_id;
      competitionId = FIFA_WORLD_CUP_2026_COMPETITION_ID;
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
      const kickoffTimeMs = new Date(fixture.kickoff_at).getTime(); // UTC-based epoch ms
      const nowMs = Date.now();
      if (kickoffTimeMs <= nowMs) {
        return NextResponse.json(
          { error: "Picks are locked for this match" },
          { status: 400 }
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
    if (authUserId) {
      const { error: eventError } = await supabaseAdmin
        .from("pick_events")
        .insert({
          auth_user_id: authUserId,
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
          league_id: participantLeagueId,
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

    // Reconcile paper_bets for this fixture (create/update to match picks; do not overwrite kickoff_odds)
    syncPaperBetsForFixture(fixtureId).catch((err) => {
      console.error("[Picks] syncPaperBetsForFixture error:", err);
    });

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

function trimBodyString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Remove a match pick (World Cup unauthenticated path mirrors POST; auth path for same participant). */
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const requestedParticipantId = trimBodyString(body?.participantId);
    const fixtureId = trimBodyString(body?.fixtureId);

    if (!fixtureId || !requestedParticipantId) {
      return NextResponse.json(
        {
          error: "participantId and fixtureId are required",
          details: "Send JSON body { participantId, fixtureId }",
        },
        { status: 400 }
      );
    }

    const supabase = createServerClient(req);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let participantId = "";
    let competitionId = "";

    if (user) {
      const { data: me, error: meErr } = await supabase
        .from("participants")
        .select("id, league_id")
        .eq("auth_user_id", user.id)
        .single();

      if (meErr || !me) {
        return NextResponse.json(
          { error: "NO_PARTICIPANT", details: meErr?.message || "No participant found" },
          { status: 403 }
        );
      }

      if (requestedParticipantId !== me.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      const { data: league, error: leagueError } = await supabaseAdmin
        .from("leagues")
        .select("competition_id")
        .eq("id", me.league_id)
        .single();

      if (leagueError || !league) {
        console.error("[DELETE /api/picks] league lookup", leagueError);
        return NextResponse.json(
          { error: "League not found for participant", details: leagueError?.message },
          { status: 500 }
        );
      }

      participantId = me.id;
      competitionId = league.competition_id;
    } else {
      const { data: worldCupParticipant, error: wcParticipantError } = await supabaseAdmin
        .from("participants")
        .select("id, league_id")
        .eq("id", requestedParticipantId)
        .maybeSingle();

      if (wcParticipantError) {
        console.error("[DELETE /api/picks] world cup participant", wcParticipantError);
        return NextResponse.json(
          {
            error: "Invalid participant",
            details: wcParticipantError.message,
            code: wcParticipantError.code,
          },
          { status: 400 }
        );
      }
      if (!worldCupParticipant) {
        return NextResponse.json({ error: "Invalid participant", details: "Participant not found" }, { status: 400 });
      }

      if (worldCupParticipant.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      participantId = worldCupParticipant.id;
      competitionId = FIFA_WORLD_CUP_2026_COMPETITION_ID;
    }

    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("fixtures")
      .select("id, kickoff_at, competition_id")
      .eq("id", fixtureId)
      .single();

    if (fixtureError || !fixture) {
      console.error("[DELETE /api/picks] fixture", fixtureError);
      return NextResponse.json(
        {
          error: "Fixture not found",
          details: fixtureError?.message,
          code: fixtureError?.code,
        },
        { status: 404 }
      );
    }

    if (fixture.competition_id !== competitionId) {
      return NextResponse.json(
        { error: "Fixture does not belong to your competition" },
        { status: 403 }
      );
    }

    const { data: existingResult, error: resultError } = await supabaseAdmin
      .from("results")
      .select("fixture_id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();

    if (resultError) {
      console.error("[DELETE /api/picks] results check", resultError);
      return NextResponse.json(
        { error: "Failed to validate fixture lock state", details: resultError.message },
        { status: 500 }
      );
    }

    if (existingResult) {
      return NextResponse.json(
        { error: "Fixture is locked (final result recorded)" },
        { status: 403 }
      );
    }

    if (fixture.kickoff_at) {
      const kickoffTimeMs = new Date(fixture.kickoff_at).getTime();
      if (kickoffTimeMs <= Date.now()) {
        return NextResponse.json(
          { error: "Picks are locked for this match" },
          { status: 400 }
        );
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("picks")
      .delete()
      .eq("participant_id", participantId)
      .eq("fixture_id", fixtureId);

    if (deleteError) {
      console.error("[DELETE /api/picks] delete", deleteError);
      return NextResponse.json(
        {
          error: "Failed to delete pick",
          details: deleteError.message,
          code: deleteError.code,
        },
        { status: 500 }
      );
    }

    syncPaperBetsForFixture(fixtureId).catch((err) => {
      console.error("[DELETE /api/picks] syncPaperBetsForFixture", err);
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/picks] unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
