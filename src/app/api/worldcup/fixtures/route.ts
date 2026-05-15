import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantFromRequest } from "@/lib/worldCupRequestTenant";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includePast = searchParams.get("includePast") === "true";
    const nowISO = new Date().toISOString();

    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    let query = supabaseAdmin
      .from("fixtures")
      .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
      .eq("competition_id", tenant.competitionId)
      .order("kickoff_at", { ascending: true });

    if (!includePast) {
      query = query.gt("kickoff_at", nowISO);
    }

    const { data, error } = await query;

    if (error) {
      console.error("World Cup fixtures fetch error:", error);
      return NextResponse.json({ error: "Failed to load fixtures" }, { status: 500 });
    }

    return NextResponse.json({ fixtures: data || [], tenant: tenant.slug }, { status: 200 });
  } catch (err) {
    console.error("World Cup fixtures route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
