import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabaseClient";
import { FIFA_WORLD_CUP_2026_COMPETITION_ID } from "@/lib/worldCupIds";
import {
  normalizeTeamCode,
  officialTopScoringTeamCodesFromResult,
} from "@/lib/worldCupScoring";

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized", details: "Missing bearer token" }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", details: userError?.message || "Invalid session" },
        { status: 401 }
      ),
    };
  }
  const adminEmails =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) || [];
  const userEmailLower = user.email?.toLowerCase() || "";
  if (!adminEmails.includes(userEmailLower)) {
    return { error: NextResponse.json({ error: "Forbidden", details: "Email not in admin allowlist" }, { status: 403 }) };
  }
  return { user };
}

function wcGroupLabelFromDb(groupName: string | null | undefined): string {
  const normalized = typeof groupName === "string" ? groupName.trim() : "";
  if (!normalized) return "Ungrouped";
  if (/^group\s/i.test(normalized)) return normalized;
  return `Group ${normalized}`;
}

type TeamRow = { code: string; name: string };

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const competitionId = FIFA_WORLD_CUP_2026_COMPETITION_ID;

    const { data: teamsRows, error: teamsError } = await supabaseAdmin
      .from("world_cup_teams")
      .select("code, name, group_name")
      .order("code", { ascending: true });

    if (teamsError) {
      console.error("[WC admin competition-results GET] world_cup_teams", teamsError);
      return NextResponse.json(
        { error: "Failed to load teams", details: teamsError.message, code: teamsError.code },
        { status: 500 }
      );
    }

    const allTeams: TeamRow[] = [];
    const teamsByGroup: Record<string, TeamRow[]> = {};
    for (const row of teamsRows || []) {
      const code = String(row.code || "").trim();
      if (!code) continue;
      const name = String(row.name || code).trim() || code;
      const t = { code, name };
      allTeams.push(t);
      const g = wcGroupLabelFromDb(row.group_name);
      if (!teamsByGroup[g]) teamsByGroup[g] = [];
      teamsByGroup[g].push(t);
    }
    for (const g of Object.keys(teamsByGroup)) {
      teamsByGroup[g].sort((a, b) => a.name.localeCompare(b.name));
    }

    const { data: resultRow, error: resultError } = await supabaseAdmin
      .from("worldcup_competition_results")
      .select(
        "id, competition_id, winner_team_code, semifinalist_team_codes, group_results, total_goals, top_scoring_team_code, top_scoring_team_codes, updated_at"
      )
      .eq("competition_id", competitionId)
      .maybeSingle();

    if (resultError) {
      console.error("[WC admin competition-results GET] row", resultError);
      return NextResponse.json(
        { error: "Failed to load competition results", details: resultError.message, code: resultError.code },
        { status: 500 }
      );
    }

    const result = resultRow
      ? {
          ...resultRow,
          top_scoring_team_codes: officialTopScoringTeamCodesFromResult(resultRow),
        }
      : null;

    return NextResponse.json(
      {
        result,
        teams: allTeams,
        teamsByGroup,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[WC admin competition-results GET] unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

function normalizeSemifinalists(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, 4).map((x) => (typeof x === "string" ? x.trim() : ""));
  while (out.length < 4) out.push("");
  return out;
}

function normalizeGroupResults(raw: unknown): Record<string, { first: string; second: string }> | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, { first: string; second: string }> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const first = typeof (v as { first?: unknown }).first === "string" ? (v as { first: string }).first.trim() : "";
    const second =
      typeof (v as { second?: unknown }).second === "string" ? (v as { second: string }).second.trim() : "";
    const f = first;
    let s = second;
    if (f && s && f === s) s = "";
    out[k] = { first: f, second: s };
  }
  return out;
}

function normalizeTopScoringTeamCodes(
  raw: unknown,
  validTeamCodes: Set<string>
): { codes: string[] | null; error?: string } {
  if (raw === undefined || raw === null) {
    return { codes: null };
  }
  if (!Array.isArray(raw)) {
    return { codes: null, error: "Expected top_scoring_team_codes to be an array of team codes" };
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const code = normalizeTeamCode(item);
    if (!code) continue;
    if (!validTeamCodes.has(code)) {
      return { codes: null, error: `Unknown World Cup team code: ${item}` };
    }
    if (seen.has(code)) continue;
    seen.add(code);
    normalized.push(code);
  }

  return { codes: normalized.length > 0 ? normalized : null };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const competitionId = FIFA_WORLD_CUP_2026_COMPETITION_ID;
    const body = await req.json().catch(() => ({}));

    const { data: teamsRows, error: teamsError } = await supabaseAdmin
      .from("world_cup_teams")
      .select("code");

    if (teamsError) {
      console.error("[WC admin competition-results POST] world_cup_teams", teamsError);
      return NextResponse.json(
        { error: "Failed to validate teams", details: teamsError.message },
        { status: 500 }
      );
    }

    const validTeamCodes = new Set<string>();
    for (const row of teamsRows || []) {
      const code = normalizeTeamCode(row.code);
      if (code) validTeamCodes.add(code);
    }

    const winner_team_code =
      typeof body?.winner_team_code === "string" && body.winner_team_code.trim()
        ? body.winner_team_code.trim()
        : null;

    const semifinalist_team_codes = normalizeSemifinalists(body?.semifinalist_team_codes);
    if (semifinalist_team_codes === null && body?.semifinalist_team_codes !== undefined) {
      return NextResponse.json(
        { error: "Invalid semifinalist_team_codes", details: "Expected an array of up to 4 strings" },
        { status: 400 }
      );
    }

    const group_results = normalizeGroupResults(body?.group_results);
    if (group_results === null) {
      return NextResponse.json(
        { error: "Invalid group_results", details: "Expected an object of group keys to { first, second }" },
        { status: 400 }
      );
    }

    let total_goals: number | null = null;
    if (body?.total_goals !== undefined && body?.total_goals !== null && body?.total_goals !== "") {
      const n = Number.parseInt(String(body.total_goals), 10);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "Invalid total_goals", details: "Must be an integer" }, { status: 400 });
      }
      total_goals = n;
    }

    let topScoringParsed = normalizeTopScoringTeamCodes(body?.top_scoring_team_codes, validTeamCodes);
    if (
      topScoringParsed.error &&
      body?.top_scoring_team_codes !== undefined &&
      body?.top_scoring_team_codes !== null
    ) {
      return NextResponse.json(
        { error: "Invalid top_scoring_team_codes", details: topScoringParsed.error },
        { status: 400 }
      );
    }

    if (body?.top_scoring_team_codes === undefined && body?.top_scoring_team_code !== undefined) {
      const legacy =
        typeof body.top_scoring_team_code === "string" && body.top_scoring_team_code.trim()
          ? body.top_scoring_team_code.trim()
          : null;
      topScoringParsed = normalizeTopScoringTeamCodes(
        legacy ? [legacy] : [],
        validTeamCodes
      );
      if (topScoringParsed.error) {
        return NextResponse.json(
          { error: "Invalid top_scoring_team_code", details: topScoringParsed.error },
          { status: 400 }
        );
      }
    }

    const top_scoring_team_codes = topScoringParsed.codes;
    const top_scoring_team_code = top_scoring_team_codes?.[0] ?? null;

    const row = {
      competition_id: competitionId,
      winner_team_code,
      semifinalist_team_codes,
      group_results,
      total_goals,
      top_scoring_team_code,
      top_scoring_team_codes,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: upsertError } = await supabaseAdmin
      .from("worldcup_competition_results")
      .upsert(row, { onConflict: "competition_id" })
      .select(
        "id, competition_id, winner_team_code, semifinalist_team_codes, group_results, total_goals, top_scoring_team_code, top_scoring_team_codes, updated_at"
      )
      .single();

    if (upsertError) {
      console.error("[WC admin competition-results POST]", upsertError);
      return NextResponse.json(
        { error: "Failed to save competition results", details: upsertError.message, code: upsertError.code },
        { status: 500 }
      );
    }

    const result = saved
      ? {
          ...saved,
          top_scoring_team_codes: officialTopScoringTeamCodesFromResult(saved),
        }
      : null;

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("[WC admin competition-results POST] unexpected", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
