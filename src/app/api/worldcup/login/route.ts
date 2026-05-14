import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { comparePassword } from "@/lib/password";
import { resolveTenantFromBodyOrUrl } from "@/lib/worldCupRequestTenant";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generic error for any auth failure — never leak whether the email exists,
 * is in a different tenant, or has no password set yet.
 */
const GENERIC_AUTH_ERROR = "Invalid email or password";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const tenantRes = resolveTenantFromBodyOrUrl(body, request);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const { data: contacts, error: contactError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id")
      .ilike("email", email);

    if (contactError) {
      console.error("[worldcup/login] contact lookup error:", contactError);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const participantIds = (contacts || [])
      .map((c) => c.participant_id as string | undefined)
      .filter((id): id is string => !!id);

    if (participantIds.length === 0) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Scope to this tenant's league — same email can exist in multiple tenants;
    // there must be at most one row per (email, tenant.leagueId) by our register guard.
    const { data: participant, error: participantError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name, league_id, password_hash")
      .in("id", participantIds)
      .eq("league_id", tenant.leagueId)
      .maybeSingle();

    if (participantError) {
      console.error("[worldcup/login] participant lookup error:", participantError);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    if (!participant || !participant.password_hash) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const valid = await comparePassword(password, participant.password_hash);
    if (!valid) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    return NextResponse.json(
      {
        participantId: participant.id,
        team_name: participant.team_name ?? null,
        tenant: tenant.slug,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup login error:", err);
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}
