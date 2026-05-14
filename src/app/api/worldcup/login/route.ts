import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { comparePassword } from "@/lib/password";
import { resolveTenantFromBodyOrUrl } from "@/lib/worldCupRequestTenant";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const participantId = String(body?.participantId ?? "").trim();
    const password = String(body?.password ?? "");

    if (!participantId || !password) {
      return NextResponse.json(
        { error: "participantId and password are required" },
        { status: 400 }
      );
    }

    const tenantRes = resolveTenantFromBodyOrUrl(body, request);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const { data: participant, error } = await supabaseAdmin
      .from("participants")
      .select("id, league_id, password_hash")
      .eq("id", participantId)
      .maybeSingle();

    if (error) {
      console.error("World Cup login participant fetch error:", error);
      return NextResponse.json({ error: "Failed to login" }, { status: 500 });
    }

    if (!participant) {
      return NextResponse.json({ error: "Invalid participant" }, { status: 404 });
    }

    if (participant.league_id !== tenant.leagueId) {
      return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
    }

    if (!participant.password_hash) {
      return NextResponse.json(
        {
          error:
            "This profile does not have a password yet. Please register again or contact the organiser.",
        },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, participant.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json(
      { participantId: participant.id, tenant: tenant.slug },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup login error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
