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
    const { id, round_id, match_number, home_team_code, away_team_code, kickoff_at } = body;

    if (!round_id || !match_number || !home_team_code || !away_team_code) {
      return NextResponse.json(
        { error: "round_id, match_number, home_team_code, and away_team_code are required" },
        { status: 400 }
      );
    }

    const fixtureData: any = {
      round_id,
      match_number,
      home_team_code,
      away_team_code,
      kickoff_at: kickoff_at || null,
    };

    let data;
    let error;

    if (id) {
      // Update existing fixture
      const result = await supabaseAdmin
        .from("fixtures")
        .update(fixtureData)
        .eq("id", id)
        .select();
      data = result.data;
      error = result.error;
    } else {
      // Insert new fixture
      const result = await supabaseAdmin
        .from("fixtures")
        .insert([fixtureData])
        .select();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("Error saving fixture:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save fixture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Admin fixtures error:", err);
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Delete using supabaseAdmin (service role)
    const { error } = await supabaseAdmin
      .from("fixtures")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting fixture:", error);
      return NextResponse.json(
        { error: error.message || "Failed to delete fixture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Admin fixtures delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
