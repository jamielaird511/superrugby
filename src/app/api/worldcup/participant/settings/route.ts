import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { comparePassword, hashPassword } from "@/lib/password";
import { FIFA_WORLD_CUP_2026_LEAGUE_ID } from "@/lib/worldCupIds";
import { getWorldCupCompetitionId } from "@/lib/worldCupScope";

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function validateWorldCupParticipantScope(participantId: string) {
  const wcCompId = await getWorldCupCompetitionId(supabaseAdmin);
  if (!wcCompId) return { ok: false as const, error: "World Cup competition could not be resolved" };

  const { data: participant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("id, name, team_name, password_hash, league_id")
    .eq("id", participantId)
    .eq("league_id", FIFA_WORLD_CUP_2026_LEAGUE_ID)
    .maybeSingle();

  if (participantError) return { ok: false as const, error: "Failed to load participant" };
  if (!participant) return { ok: false as const, error: "Participant not found" };

  const { data: league, error: leagueError } = await supabaseAdmin
    .from("leagues")
    .select("id, competition_id")
    .eq("id", participant.league_id)
    .maybeSingle();

  if (leagueError || !league || league.competition_id !== wcCompId) {
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

    const scoped = await validateWorldCupParticipantScope(participantId);
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

    const scoped = await validateWorldCupParticipantScope(participantId);
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
      const { error: updateNameError } = await supabaseAdmin
        .from("participants")
        .update({ team_name: displayName, updated_at: new Date().toISOString() })
        .eq("id", participantId);

      if (updateNameError) {
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
    const { error: updatePwError } = await supabaseAdmin
      .from("participants")
      .update({ password_hash: nextHash, updated_at: new Date().toISOString() })
      .eq("id", participantId);

    if (updatePwError) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Password updated." }, { status: 200 });
  } catch (err) {
    console.error("World Cup participant settings PATCH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

