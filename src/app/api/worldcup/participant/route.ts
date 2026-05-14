import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantFromRequest } from "@/lib/worldCupRequestTenant";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = (searchParams.get("participantId") || "").trim();

    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, name, team_name, league_id")
      .eq("id", participantId)
      .eq("league_id", tenant.leagueId)
      .maybeSingle();

    if (error) {
      console.error("World Cup participant fetch error:", error);
      return NextResponse.json({ error: "Failed to load participant" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    return NextResponse.json({ participant: data, tenant: tenant.slug }, { status: 200 });
  } catch (err) {
    console.error("World Cup participant route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
