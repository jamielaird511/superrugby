import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { comparePassword, hashPassword } from "@/lib/password";
import { resolveWorldCupCompetitionIdForTenant } from "@/lib/worldCupScope";
import {
  resolveTenantFromBodyOrUrl,
  resolveTenantFromRequest,
} from "@/lib/worldCupRequestTenant";
import type { WorldCupTenant } from "@/lib/worldCupIds";

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function validateWorldCupParticipantScope(
  participantId: string,
  tenant: WorldCupTenant
) {
  const wcCompId = await resolveWorldCupCompetitionIdForTenant(supabaseAdmin, tenant);
  if (!wcCompId) return { ok: false as const, error: "World Cup competition could not be resolved" };

  const { data: participant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("id, name, team_name, password_hash, league_id")
    .eq("id", participantId)
    .eq("league_id", tenant.leagueId)
    .maybeSingle();

  if (participantError) {
    console.error("[worldcup/participant/settings] participant lookup:", {
      participantId,
      tenant: tenant.slug,
      message: participantError.message,
      code: participantError.code,
      details: participantError.details,
    });
    return { ok: false as const, error: "Failed to load participant" };
  }
  if (!participant) return { ok: false as const, error: "Participant not found" };

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, competition_id")
    .eq("id", participant.league_id)
    .maybeSingle();

  if (leagueError || !league || league.competition_id !== wcCompId) {
    console.error("[worldcup/participant/settings] league scope check failed:", {
      participantId,
      tenant: tenant.slug,
      leagueError,
      leagueRow: league,
      expectedCompetitionId: wcCompId,
    });
    return { ok: false as const, error: "Participant not in World Cup scope" };
  }

  return { ok: true as const, participant };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const participantId = asTrimmedString(searchParams.get("participantId"));
    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const scoped = await validateWorldCupParticipantScope(participantId, tenant);
    if (!scoped.ok) {
      return NextResponse.json(
        { error: scoped.error },
        { status: scoped.error === "Participant not found" ? 404 : 400 }
      );
    }

    return NextResponse.json(
      {
        participant: {
          id: scoped.participant.id,
          name: scoped.participant.name,
          team_name: scoped.participant.team_name,
        },
        tenant: tenant.slug,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("World Cup participant settings GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const participantId = asTrimmedString(body?.participantId);
    if (!participantId) {
      return NextResponse.json({ error: "participantId is required" }, { status: 400 });
    }

    const tenantRes = resolveTenantFromBodyOrUrl(body, req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const scoped = await validateWorldCupParticipantScope(participantId, tenant);
    if (!scoped.ok) {
      return NextResponse.json(
        { error: scoped.error },
        { status: scoped.error === "Participant not found" ? 404 : 400 }
      );
    }

    const displayName = asTrimmedString(body?.displayName);
    const currentPassword = String(body?.currentPassword ?? "");
    const newPassword = String(body?.newPassword ?? "");
    const confirmNewPassword = String(body?.confirmNewPassword ?? "");

    if (displayName) {
      const { data: updatedRow, error: updateNameError } = await supabaseAdmin
        .from("participants")
        .update({ team_name: displayName })
        .eq("id", participantId)
        .eq("league_id", tenant.leagueId)
        .select("id")
        .maybeSingle();

      if (updateNameError) {
        console.error("[worldcup/participant/settings] team_name update failed:", {
          participantId,
          tenant: tenant.slug,
          message: updateNameError.message,
          code: updateNameError.code,
          details: updateNameError.details,
        });
        return NextResponse.json({ error: "Failed to update display name" }, { status: 500 });
      }

      if (!updatedRow) {
        console.error("[worldcup/participant/settings] team_name update affected 0 rows", {
          participantId,
          tenant: tenant.slug,
        });
        return NextResponse.json({ error: "Failed to update display name" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: "Display name updated." }, { status: 200 });
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return NextResponse.json(
        { error: "currentPassword, newPassword, and confirmNewPassword are required" },
        { status: 400 }
      );
    }
    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }
    if (!scoped.participant.password_hash) {
      return NextResponse.json(
        { error: "Password is not set for this participant" },
        { status: 400 }
      );
    }

    const validCurrent = await comparePassword(currentPassword, scoped.participant.password_hash);
    if (!validCurrent) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const nextHash = await hashPassword(newPassword);
    const { data: updatedPwRow, error: updatePwError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: nextHash })
      .eq("id", participantId)
      .eq("league_id", tenant.leagueId)
      .select("id")
      .maybeSingle();

    if (updatePwError) {
      console.error("[worldcup/participant/settings] password update failed:", {
        participantId,
        tenant: tenant.slug,
        message: updatePwError.message,
        code: updatePwError.code,
        details: updatePwError.details,
      });
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    if (!updatedPwRow) {
      console.error("[worldcup/participant/settings] password update affected 0 rows", {
        participantId,
        tenant: tenant.slug,
      });
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Password updated." }, { status: 200 });
  } catch (err) {
    console.error("World Cup participant settings PATCH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
