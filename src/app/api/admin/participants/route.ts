import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    const leagueId = searchParams.get("leagueId") ?? undefined;

    let query = supabaseAdmin
      .from("participants")
      .select("id, team_name, category")
      .order("team_name", { ascending: true });
    if (leagueId) {
      query = query.eq("league_id", leagueId);
    }
    const { data: participantsData, error: participantsError } = await query;

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return NextResponse.json({ error: participantsError.message || "Failed to fetch participants" }, { status: 500 });
    }

    const ids = (participantsData || []).map((p) => p.id);
    if (ids.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: primaryContacts, error: contactsError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id, email")
      .eq("is_primary", true)
      .in("participant_id", ids);

    if (contactsError) {
      console.error("Error fetching primary contacts:", contactsError);
    }

    const primaryByParticipant = new Map<string, string>();
    (primaryContacts || []).forEach((c) => primaryByParticipant.set(c.participant_id, c.email));

    const data = (participantsData || []).map((p) => ({
      id: p.id,
      team_name: p.team_name ?? null,
      category: p.category ?? null,
      primary_email: primaryByParticipant.get(p.id) ?? null,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Admin participants GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
