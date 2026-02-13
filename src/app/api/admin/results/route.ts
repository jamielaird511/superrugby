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
    const { fixture_id, winning_team, margin_band } = body;

    if (!fixture_id || !winning_team) {
      return NextResponse.json(
        { error: "fixture_id and winning_team are required" },
        { status: 400 }
      );
    }

    // Validate margin_band: must be null, "1-12", or "13+"
    if (margin_band !== null && margin_band !== "1-12" && margin_band !== "13+") {
      return NextResponse.json(
        { error: "margin_band must be null, '1-12', or '13+'" },
        { status: 400 }
      );
    }

    // Ensure margin_band is null for DRAW
    const finalMarginBand = winning_team === "DRAW" ? null : margin_band;

    // Upsert using supabaseAdmin (service role)
    const { data, error } = await supabaseAdmin
      .from("results")
      .upsert(
        {
          fixture_id,
          winning_team,
          margin_band: finalMarginBand,
        },
        { onConflict: "fixture_id" }
      )
      .select();

    if (error) {
      console.error("Error saving result:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save result" },
        { status: 500 }
      );
    }

    // Auto-lock paper bet kickoff odds for this fixture
    if (fixture_id) {
      const { error: rpcError } = await supabaseAdmin.rpc("lock_paper_bets_kickoff_odds", {
        p_fixture_id: fixture_id,
      });
      if (rpcError) {
        console.error("lock_paper_bets_kickoff_odds RPC failed:", rpcError);
      }
    }

    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Admin results error:", err);
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

    const { searchParams } = new URL(req.url);
    const fixtureId = searchParams.get("fixtureId");

    if (!fixtureId) {
      return NextResponse.json(
        { error: "fixtureId is required" },
        { status: 400 }
      );
    }

    // Delete using supabaseAdmin (service role)
    const { error } = await supabaseAdmin
      .from("results")
      .delete()
      .eq("fixture_id", fixtureId);

    if (error) {
      console.error("Error deleting result:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete result" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Admin results delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
