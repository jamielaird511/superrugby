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
    const { season, round_number } = body;

    if (!season || !round_number) {
      return NextResponse.json(
        { error: "season and round_number are required" },
        { status: 400 }
      );
    }

    // Insert using supabaseAdmin (service role)
    const { data, error } = await supabaseAdmin
      .from("rounds")
      .insert([{ season, round_number }])
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
