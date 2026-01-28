import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_EVENTS = [
  "landing_view",
  "login_view",
  "register_success",
  "login_success",
  "pick_saved",
] as const;

type AllowedEvent = typeof ALLOWED_EVENTS[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventName, participantId, metadata } = body;

    // Validate eventName
    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json(
        { error: "eventName is required and must be a string" },
        { status: 400 }
      );
    }

    if (!ALLOWED_EVENTS.includes(eventName as AllowedEvent)) {
      return NextResponse.json(
        { error: `Invalid eventName. Must be one of: ${ALLOWED_EVENTS.join(", ")}` },
        { status: 400 }
      );
    }

    // Extract IP from headers (respect x-forwarded-for for proxies)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : req.headers.get("x-real-ip") || null;

    // Extract user agent
    const userAgent = req.headers.get("user-agent") || null;

    // Insert analytics event using service role
    const { error: insertError } = await supabaseAdmin
      .from("analytics_events")
      .insert([
        {
          event_name: eventName,
          participant_id: participantId || null,
          metadata: metadata || null,
          user_agent: userAgent,
          ip: ip,
        },
      ]);

    if (insertError) {
      console.error("Error inserting analytics event:", insertError);
      return NextResponse.json(
        { error: "Failed to record analytics event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Analytics API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
