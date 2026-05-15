import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";

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

async function getGroupCount(): Promise<{ count: number; error?: string; code?: string }> {
  const { data: teams, error } = await supabaseAdmin.from("world_cup_teams").select("group_name");
  if (error) {
    console.error("[WC admin participants GET] world_cup_teams", error);
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

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  const userEmailLower = user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmailLower)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const tenantSlug = new URL(req.url).searchParams.get("tenant")?.trim().toLowerCase() || "";
  const tenant = resolveWorldCupTenant(tenantSlug);
  if (!tenant) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const { data: participantRows, error: participantsError } = await supabaseAdmin
      .from("participants")
      .select("id, name, team_name, created_at")
      .eq("league_id", tenant.leagueId)
      .order("created_at", { ascending: false });

    if (participantsError) {
      console.error("[WC admin participants GET] participants", participantsError);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    const participants = participantRows || [];
    const participantIds = participants.map((p) => p.id as string).filter(Boolean);

    if (participantIds.length === 0) {
      return NextResponse.json({ tenant: tenant.slug, participants: [] }, { status: 200 });
    }

    const { data: contactsRows, error: contactsError } = await supabaseAdmin
      .from("participant_contacts")
      .select("participant_id, email, is_primary")
      .in("participant_id", participantIds);

    if (contactsError) {
      console.error("[WC admin participants GET] participant_contacts", contactsError);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    const contactsByParticipant: Record<string, { email: string; is_primary: boolean }[]> = {};
    for (const row of contactsRows || []) {
      const pid = row.participant_id as string | undefined;
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!pid || !email) continue;
      if (!contactsByParticipant[pid]) contactsByParticipant[pid] = [];
      contactsByParticipant[pid].push({
        email,
        is_primary: Boolean((row as { is_primary?: boolean }).is_primary),
      });
    }

    function emailForParticipant(pid: string): string | null {
      const list = contactsByParticipant[pid];
      if (!list?.length) return null;
      const primary = list.find((c) => c.is_primary);
      return (primary ?? list[0]).email;
    }

    const { data: pickRows, error: picksError } = await supabaseAdmin
      .from("picks")
      .select("participant_id")
      .eq("league_id", tenant.leagueId)
      .in("participant_id", participantIds);

    if (picksError) {
      console.error("[WC admin participants GET] picks", picksError);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    const matchPickCount: Record<string, number> = {};
    for (const row of pickRows || []) {
      const pid = row.participant_id as string | undefined;
      if (!pid) continue;
      matchPickCount[pid] = (matchPickCount[pid] || 0) + 1;
    }

    const { data: compPickRows, error: compPicksError } = await supabaseAdmin
      .from("worldcup_competition_picks")
      .select(
        "participant_id, winner_team_code, semifinalist_team_codes, group_picks, total_goals, top_scoring_team_code"
      )
      .eq("competition_id", tenant.competitionId)
      .in("participant_id", participantIds);

    if (compPicksError) {
      console.error("[WC admin participants GET] worldcup_competition_picks", compPicksError);
      return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
    }

    const compPickByParticipant: Record<string, StoredCompetitionPicks> = {};
    for (const row of compPickRows || []) {
      const pid = row.participant_id as string | undefined;
      if (!pid) continue;
      compPickByParticipant[pid] = {
        winner_team_code: (row.winner_team_code as string | null) ?? null,
        semifinalist_team_codes: (row.semifinalist_team_codes as string[] | null) ?? null,
        group_picks: (row.group_picks as StoredCompetitionPicks["group_picks"]) ?? null,
        total_goals: typeof row.total_goals === "number" ? row.total_goals : null,
        top_scoring_team_code: (row.top_scoring_team_code as string | null) ?? null,
      };
    }

    const groupCountRes = await getGroupCount();
    const groupCount = groupCountRes.count > 0 ? groupCountRes.count : 12;

    const payload = participants.map((p) => {
      const id = p.id as string;
      const name = asTrimmedString(p.name);
      const teamName = asTrimmedString(p.team_name);
      const playerName = name || teamName || "—";
      const stored = compPickByParticipant[id] ?? null;
      const { completed, total } = completionFromStored(stored, groupCount);
      return {
        id,
        playerName,
        email: emailForParticipant(id),
        joinedAt: p.created_at as string,
        matchPicksCount: matchPickCount[id] ?? 0,
        competitionPicksCompleted: completed,
        competitionPicksTotal: total,
      };
    });

    payload.sort((a, b) => a.playerName.localeCompare(b.playerName, undefined, { sensitivity: "base" }));

    return NextResponse.json({ tenant: tenant.slug, participants: payload }, { status: 200 });
  } catch (e) {
    console.error("[WC admin participants GET] unexpected", e);
    return NextResponse.json({ error: "Failed to load participants" }, { status: 500 });
  }
}
