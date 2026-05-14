import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { WorldCupTenant } from "@/lib/worldCupIds";
import {
  resolveTenantFromBodyOrUrl,
  resolveTenantFromRequest,
} from "@/lib/worldCupRequestTenant";

type StoredCompetitionPicks = {
  winner_team_code: string | null;
  semifinalist_team_codes: string[] | null;
  group_picks: Record<string, { first?: string; second?: string }> | null;
  total_goals: number | null;
  top_scoring_team_code: string | null;
};

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize DB `group_name` to the same key used in `group_picks` and UI sections. */
function groupLabelFromGroupName(row: Record<string, unknown>): string {
  const raw = row.group_name;
  const normalized = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!normalized) return "Ungrouped";
  if (/^group\s/i.test(normalized)) return normalized;
  return `Group ${normalized}`;
}

function completionFromStored(
  picks: StoredCompetitionPicks | null,
  groupCount: number
): { completed: number; total: number } {
  if (!picks) {
    return { completed: 0, total: 1 + 4 + groupCount * 2 + 2 };
  }
  const groupObj = picks.group_picks || {};
  let groupCompleted = 0;
  for (const value of Object.values(groupObj)) {
    if (!value || typeof value !== "object") continue;
    if (typeof value.first === "string" && value.first.trim()) groupCompleted += 1;
    if (typeof value.second === "string" && value.second.trim()) groupCompleted += 1;
  }
  const semiCompleted = (picks.semifinalist_team_codes || []).filter((x) => !!asTrimmedString(x))
    .length;
  const completed =
    (asTrimmedString(picks.winner_team_code) ? 1 : 0) +
    semiCompleted +
    groupCompleted +
    (typeof picks.total_goals === "number" ? 1 : 0) +
    (asTrimmedString(picks.top_scoring_team_code) ? 1 : 0);
  return { completed, total: 1 + 4 + groupCount * 2 + 2 };
}

async function validateWorldCupParticipant(
  participantId: string,
  tenant: WorldCupTenant
): Promise<
  | { ok: true }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      details?: string;
      code?: string;
    }
> {
  const { data: participant, error: participantError } = await supabaseAdmin
    .from("participants")
    .select("id, league_id")
    .eq("id", participantId)
    .maybeSingle();

  if (participantError) {
    console.error("[competition-picks] participant validation (supabase)", participantError);
    return {
      ok: false,
      httpStatus: 500,
      error: "Failed to load participant",
      details: participantError.message,
      code: participantError.code,
    };
  }
  if (!participant) {
    return { ok: false, httpStatus: 404, error: "Participant not found" };
  }
  if (participant.league_id !== tenant.leagueId) {
    return {
      ok: false,
      httpStatus: 400,
      error: "Participant is not in this World Cup tenant",
    };
  }

  return { ok: true };
}

async function getGroupCount(): Promise<{ count: number; error?: string; code?: string }> {
  const { data: teams, error } = await supabaseAdmin
    .from("world_cup_teams")
    .select("group_name");
  if (error) {
    console.error("[competition-picks] getGroupCount (world_cup_teams)", error);
    return { count: 0, error: error.message, code: error.code };
  }
  const groups = new Set<string>();
  for (const row of teams || []) {
    const raw = (row as { group_name?: string | null }).group_name;
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed) continue;
    groups.add(groupLabelFromGroupName({ group_name: raw }));
  }
  return { count: groups.size };
}

async function isLocked(tenant: WorldCupTenant): Promise<boolean> {
  const { data: firstFixture, error } = await supabaseAdmin
    .from("fixtures")
    .select("kickoff_at")
    .eq("competition_id", tenant.competitionId)
    .eq("league_id", tenant.leagueId)
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[competition-picks] isLocked (fixtures)", error);
    return false;
  }

  if (!firstFixture?.kickoff_at) return false;
  return Date.parse(firstFixture.kickoff_at) <= Date.now();
}

export async function GET(req: NextRequest) {
  try {
    const tenantRes = resolveTenantFromRequest(req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const participantId = asTrimmedString(new URL(req.url).searchParams.get("participantId"));
    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required", details: "Query string participantId is missing or empty" },
        { status: 400 }
      );
    }

    const scoped = await validateWorldCupParticipant(participantId, tenant);
    if (!scoped.ok) {
      return NextResponse.json(
        {
          error: scoped.error,
          ...(scoped.details && { details: scoped.details }),
          ...(scoped.code && { code: scoped.code }),
        },
        { status: scoped.httpStatus }
      );
    }

    const [rowRes, groupRes, locked] = await Promise.all([
      supabaseAdmin
        .from("worldcup_competition_picks")
        .select(
          "winner_team_code, semifinalist_team_codes, group_picks, total_goals, top_scoring_team_code"
        )
        .eq("participant_id", participantId)
        .eq("competition_id", tenant.competitionId)
        .maybeSingle(),
      getGroupCount(),
      isLocked(tenant),
    ]);

    if (groupRes.error) {
      return NextResponse.json(
        {
          error: "Failed to load group metadata for completion",
          details: groupRes.error,
          ...(groupRes.code && { code: groupRes.code }),
        },
        { status: 500 }
      );
    }

    if (rowRes.error) {
      console.error("[competition-picks] GET worldcup_competition_picks", rowRes.error);
      return NextResponse.json(
        {
          error: "Failed to load competition picks",
          details: rowRes.error.message,
          code: rowRes.error.code,
        },
        { status: 500 }
      );
    }

    const picks = (rowRes.data || null) as StoredCompetitionPicks | null;
    return NextResponse.json(
      { picks, completion: completionFromStored(picks, groupRes.count), locked, tenant: tenant.slug },
      { status: 200 }
    );
  } catch (err) {
    console.error("[competition-picks] GET unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantRes = resolveTenantFromBodyOrUrl(body, req);
    if (!tenantRes.ok) return tenantRes.response;
    const { tenant } = tenantRes;

    const participantId = asTrimmedString(body?.participantId);
    if (!participantId) {
      return NextResponse.json(
        { error: "participantId is required", details: "JSON body must include participantId" },
        { status: 400 }
      );
    }

    const scoped = await validateWorldCupParticipant(participantId, tenant);
    if (!scoped.ok) {
      return NextResponse.json(
        {
          error: scoped.error,
          ...(scoped.details && { details: scoped.details }),
          ...(scoped.code && { code: scoped.code }),
        },
        { status: scoped.httpStatus }
      );
    }

    const locked = await isLocked(tenant);
    if (locked) {
      return NextResponse.json(
        { error: "Competition picks are locked", details: "Tournament has started (first kickoff in the past)" },
        { status: 400 }
      );
    }

    const semiRaw = Array.isArray(body?.semifinalist_team_codes)
      ? (body.semifinalist_team_codes as unknown[])
      : [];
    const semifinalistTeamCodes = semiRaw.slice(0, 4).map((x) => asTrimmedString(x));

    const groupPicks = (body?.group_picks || {}) as Record<string, { first?: string; second?: string }>;
    const normalizedGroupPicks: Record<string, { first: string; second: string }> = {};
    for (const [group, value] of Object.entries(groupPicks)) {
      normalizedGroupPicks[group] = {
        first: asTrimmedString(value?.first),
        second: asTrimmedString(value?.second),
      };
    }

    const totalGoals =
      body?.total_goals === null || body?.total_goals === undefined || body?.total_goals === ""
        ? null
        : Number.parseInt(String(body.total_goals), 10);
    if (totalGoals !== null && !Number.isFinite(totalGoals)) {
      return NextResponse.json(
        { error: "total_goals must be an integer", details: String(body?.total_goals) },
        { status: 400 }
      );
    }

    const semiNonEmpty = semifinalistTeamCodes.filter((c) => c.length > 0);
    const semiUnique = new Set(semiNonEmpty);
    if (semiUnique.size !== semiNonEmpty.length) {
      return NextResponse.json({ error: "Choose four different semi-finalists." }, { status: 400 });
    }

    for (const g of Object.values(normalizedGroupPicks)) {
      if (g.first && g.second && g.first === g.second) {
        return NextResponse.json(
          { error: "Group picks must have different 1st and 2nd teams." },
          { status: 400 }
        );
      }
    }

    const rowToSave = {
      participant_id: participantId,
      competition_id: tenant.competitionId,
      winner_team_code: asTrimmedString(body?.winner_team_code) || null,
      semifinalist_team_codes: semifinalistTeamCodes,
      group_picks: normalizedGroupPicks,
      total_goals: totalGoals,
      top_scoring_team_code: asTrimmedString(body?.top_scoring_team_code) || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from("worldcup_competition_picks")
      .upsert(rowToSave, { onConflict: "participant_id,competition_id" })
      .select(
        "winner_team_code, semifinalist_team_codes, group_picks, total_goals, top_scoring_team_code"
      )
      .single();
    if (error) {
      console.error("[competition-picks] POST upsert", error);
      return NextResponse.json(
        {
          error: "Failed to save competition picks",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    const groupRes = await getGroupCount();
    if (groupRes.error) {
      console.error("[competition-picks] POST getGroupCount after save", groupRes);
    }
    const groupCount = groupRes.error ? 8 : groupRes.count;
    const picks = data as StoredCompetitionPicks;
    return NextResponse.json(
      { picks, completion: completionFromStored(picks, groupCount), locked: false, tenant: tenant.slug },
      { status: 200 }
    );
  } catch (err) {
    console.error("[competition-picks] POST unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
