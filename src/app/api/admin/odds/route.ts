import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.length || !userEmailLower || !adminEmails.includes(userEmailLower)) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      fixture_id,
      draw_odds,
      home_1_12_odds,
      home_13_plus_odds,
      away_1_12_odds,
      away_13_plus_odds,
    } = body;

    if (typeof fixture_id !== "string" || !UUID_REGEX.test(fixture_id)) {
      return NextResponse.json(
        { error: "fixture_id must be a valid UUID string" },
        { status: 400 }
      );
    }

    const oddsFields = [
      { name: "draw_odds", value: draw_odds },
      { name: "home_1_12_odds", value: home_1_12_odds },
      { name: "home_13_plus_odds", value: home_13_plus_odds },
      { name: "away_1_12_odds", value: away_1_12_odds },
      { name: "away_13_plus_odds", value: away_13_plus_odds },
    ];
    for (const { name, value } of oddsFields) {
      if (typeof value !== "number" || value < 1.01) {
        return NextResponse.json(
          { error: `${name} must be a number >= 1.01` },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("match_odds")
      .upsert(
        {
          fixture_id,
          draw_odds,
          home_1_12_odds,
          home_13_plus_odds,
          away_1_12_odds,
          away_13_plus_odds,
          odds_as_at: new Date().toISOString(),
        },
        { onConflict: "fixture_id" }
      )
      .select();

    if (error) {
      console.error("Error saving odds:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save odds" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, data: data?.[0] ?? null },
      { status: 200 }
    );
  } catch (err) {
    console.error("Admin odds error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
