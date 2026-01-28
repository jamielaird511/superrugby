import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

// Create a server Supabase client using ANON key + request cookies/session (NOT service role)
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

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    // Create server client with user session
    const supabase = createServerClient(req);

    // Require authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // Check user email is in ADMIN_EMAILS
    if (!user.email || !adminEmails.includes(user.email)) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { season, round_number, leagueCode } = body;

    if (!season || !round_number) {
      return NextResponse.json(
        { error: "season and round_number are required" },
        { status: 400 }
      );
    }

    // Look up league by leagueCode (default to ANZ2026 for backward compatibility)
    const targetLeagueCode = leagueCode || "ANZ2026";
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("id, competition_id")
      .eq("league_code", targetLeagueCode)
      .single();

    if (leagueError || !league) {
      return NextResponse.json(
        { error: `League not found: ${targetLeagueCode}` },
        { status: 404 }
      );
    }

    // Insert using supabaseAdmin (service role)
    const { data, error } = await supabaseAdmin
      .from("rounds")
      .insert([{ season, round_number, league_id: league.id, competition_id: league.competition_id }])
      .select();

    if (error) {
      console.error("Error creating round:", error);
      
      // Check for unique constraint violation (duplicate round)
      // PostgreSQL error code 23505 = unique_violation
      if (error.code === "23505" || error.message?.includes("duplicate key") || error.message?.includes("unique constraint")) {
        return NextResponse.json(
          { error: "Round already exists" },
          { status: 409 }
        );
      }
      
      // Other errors
      return NextResponse.json(
        { error: error.message || "Failed to create round" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data?.[0] || data || null }, { status: 200 });
  } catch (err) {
    console.error("Admin rounds error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const supabase = createServerClient(req);
    const { data: { user }, error: userError } = await supabase.auth.getUser();

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

    const { searchParams } = new URL(req.url);
    const roundId = searchParams.get("roundId");

    if (!roundId) {
      return NextResponse.json(
        { error: "roundId is required" },
        { status: 400 }
      );
    }

    const { data: fixtures, error: fixturesError } = await supabaseAdmin
      .from("fixtures")
      .select("id")
      .eq("round_id", roundId)
      .limit(1);

    if (fixturesError) {
      console.error("Error checking fixtures for round delete:", fixturesError);
      return NextResponse.json(
        { error: fixturesError.message || "Failed to check fixtures" },
        { status: 500 }
      );
    }

    if (fixtures && fixtures.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete a round that has fixtures. Delete fixtures first." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("rounds")
      .delete()
      .eq("id", roundId);

    if (deleteError) {
      console.error("Error deleting round:", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete round" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Admin rounds DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
