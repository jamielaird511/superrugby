import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { comparePassword } from "@/lib/password";
import {
  findWorldCupTenantByLeagueId,
  listWorldCupTenants,
  resolveWorldCupTenant,
} from "@/lib/worldCupIds";
import { readOptionalWorldCupTenantSlugFromBodyOrUrl } from "@/lib/worldCupRequestTenant";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generic error for any auth failure — never leak whether the email exists,
 * is in a different tenant, or has no password set yet.
 */
const GENERIC_AUTH_ERROR = "Invalid email or password";

type LoginOption = {
  tenantSlug: string;
  displayName: string;
  participantId: string;
  teamName: string;
};

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

    const explicitSlug = readOptionalWorldCupTenantSlugFromBodyOrUrl(body, request);

    const { data: contacts, error: contactError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id")
      .ilike("email", email);

    if (contactError) {
      console.error("[worldcup/login] contact lookup error:", contactError);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const participantIds = [
      ...new Set(
        (contacts || [])
          .map((c) => c.participant_id as string | undefined)
          .filter((id): id is string => !!id)
      ),
    ];

    if (participantIds.length === 0) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    if (explicitSlug) {
      const tenant = resolveWorldCupTenant(explicitSlug);
      if (!tenant) {
        return NextResponse.json(
          { error: "Unknown World Cup tenant", details: `tenant=${explicitSlug}` },
          { status: 400 }
        );
      }

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
    }

    const wcLeagueIds = new Set(listWorldCupTenants().map((t) => t.leagueId));

    const { data: participantRows, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, team_name, league_id, password_hash")
      .in("id", participantIds);

    if (participantsError) {
      console.error("[worldcup/login] multi-tenant participant lookup error:", participantsError);
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    const wcRows = (participantRows || []).filter(
      (p) => p.league_id && wcLeagueIds.has(p.league_id as string)
    );

    const matches: LoginOption[] = [];

    for (const p of wcRows) {
      if (!p.password_hash) continue;
      const ok = await comparePassword(password, p.password_hash as string);
      if (!ok) continue;
      const tenant = findWorldCupTenantByLeagueId(p.league_id as string);
      if (!tenant) continue;
      matches.push({
        tenantSlug: tenant.slug,
        displayName: tenant.displayName,
        participantId: p.id as string,
        teamName: (p.team_name as string | null) ?? "",
      });
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    if (matches.length === 1) {
      const m = matches[0];
      return NextResponse.json(
        {
          participantId: m.participantId,
          team_name: m.teamName || null,
          tenant: m.tenantSlug,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        requiresCompetitionSelection: true,
        options: matches,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup login error:", err);
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}
