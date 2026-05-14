import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveTenantFromRequest } from "@/lib/worldCupRequestTenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const { data, error } = await supabaseAdmin
      .from("participants")
      .select("id, name, team_name")
      .eq("league_id", tenant.leagueId)
      .order("team_name", { ascending: true });

    if (error) {
      console.error("World Cup participants fetch error:", error);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    return NextResponse.json(
      { participants: data || [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("World Cup participants route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
