import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin email allowlist
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
    const userEmailLower = user.email?.toLowerCase() || "";
    if (!adminEmails.includes(userEmailLower)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Query analytics events for last 7 days
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("analytics_events")
      .select("event_name")
      .gte("created_at", sevenDaysAgoISO);

    if (eventsError) {
      console.error("Error fetching analytics events:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch analytics" },
        { status: 500 }
      );
    }

    // Count events by type
    const counts = {
      landing_view: 0,
      login_success: 0,
      register_success: 0,
      pick_saved: 0,
    };

    (events || []).forEach((event) => {
      if (event.event_name in counts) {
        counts[event.event_name as keyof typeof counts]++;
      }
    });

    // Get total participants count
    const { count: participantsCount, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("*", { count: "exact", head: true });

    if (participantsError) {
      console.error("Error fetching participants count:", participantsError);
      return NextResponse.json(
        { error: "Failed to fetch participants count" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      landing_view: counts.landing_view,
      login_success: counts.login_success,
      register_success: counts.register_success,
      pick_saved: counts.pick_saved,
      total_participants: participantsCount || 0,
    });
  } catch (err) {
    console.error("Analytics summary API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
