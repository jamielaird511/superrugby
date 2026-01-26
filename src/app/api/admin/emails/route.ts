import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()) || [];

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

export async function GET(req: NextRequest) {
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
    const onlyUpdates = searchParams.get("onlyUpdates") !== "0";
    const includePrimary = searchParams.get("includePrimary") !== "0";
    const includeAdditional = searchParams.get("includeAdditional") !== "0";
    const category = searchParams.get("category");

    // Build query for contacts
    let query = supabaseAdmin
      .from("participant_contacts")
      .select("participant_id, email, is_primary, receives_updates, created_at");

    // Apply filters
    if (onlyUpdates) {
      query = query.eq("receives_updates", true);
    }

    if (!includePrimary && !includeAdditional) {
      // If both are excluded, return empty
      return NextResponse.json({ data: [] });
    } else if (!includePrimary) {
      query = query.eq("is_primary", false);
    } else if (!includeAdditional) {
      query = query.eq("is_primary", true);
    }

    const { data: contactsData, error: contactsError } = await query;

    if (contactsError) {
      console.error("Error fetching contacts:", contactsError);
      return NextResponse.json(
        { error: contactsError.message || "Failed to fetch contacts" },
        { status: 500 }
      );
    }

    if (!contactsData || contactsData.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get unique participant IDs
    const participantIds = Array.from(
      new Set(contactsData.map((c) => c.participant_id))
    );

    // Fetch participants
    let participantsQuery = supabaseAdmin
      .from("participants")
      .select("id, team_name, business_name, category")
      .in("id", participantIds);

    if (category) {
      participantsQuery = participantsQuery.eq("category", category);
    }

    const { data: participantsData, error: participantsError } = await participantsQuery;

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      return NextResponse.json(
        { error: participantsError.message || "Failed to fetch participants" },
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const participantsMap = new Map(
      (participantsData || []).map((p) => [p.id, p])
    );

    // Join contacts with participants
    let joinedData = (contactsData || [])
      .map((contact) => {
        const participant = participantsMap.get(contact.participant_id);
        if (!participant) return null;
        if (category && participant.category !== category) return null;
        return {
          participant_id: contact.participant_id,
          team_name: participant.team_name,
          business_name: participant.business_name,
          category: participant.category,
          email: contact.email,
          is_primary: contact.is_primary,
          receives_updates: contact.receives_updates,
          created_at: contact.created_at,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    // Sort by team_name, is_primary (desc), email
    joinedData.sort((a, b) => {
      const teamA = a.team_name || "";
      const teamB = b.team_name || "";
      if (teamA !== teamB) {
        return teamA.localeCompare(teamB);
      }
      // Then by is_primary (desc)
      if (a.is_primary !== b.is_primary) {
        return b.is_primary ? 1 : -1;
      }
      // Then by email
      return a.email.localeCompare(b.email);
    });

    return NextResponse.json({ data: joinedData });
  } catch (err) {
    console.error("Admin emails GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
