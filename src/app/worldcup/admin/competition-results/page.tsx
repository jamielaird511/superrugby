"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WorldCupAdminHeader from "@/components/worldcup/WorldCupAdminHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAdminSaveButtonClass,
  worldCupContentCardClass,
  worldCupFormAlertErrorClass,
  worldCupFormAlertSuccessClass,
  worldCupMainContentShellClass,
  worldCupNestedPanelClass,
  worldCupSectionPanelClass,
  worldCupSelectControlClass,
} from "@/lib/worldCupBranding";

const GROUP_LABELS = Array.from({ length: 12 }, (_, i) => `Group ${String.fromCharCode(65 + i)}`);

type TeamRow = { code: string; name: string };

type CompetitionResultRow = {
  id: string;
  competition_id: string;
  winner_team_code: string | null;
  semifinalist_team_codes: string[] | null;
  group_results: Record<string, { first?: string; second?: string }>;
  total_goals: number | null;
  top_scoring_team_code: string | null;
  top_scoring_team_codes?: string[];
  updated_at?: string;
};

export default function WorldCupAdminCompetitionResultsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [teamsByGroup, setTeamsByGroup] = useState<Record<string, TeamRow[]>>({});
  const [winner, setWinner] = useState("");
  const [semiFinalists, setSemiFinalists] = useState(["", "", "", ""]);
  const [groupStage, setGroupStage] = useState<Record<string, { first: string; second: string }>>({});
  const [totalGoals, setTotalGoals] = useState("");
  const [topScoringTeams, setTopScoringTeams] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyPayload = useCallback(
    (payload: {
      result: CompetitionResultRow | null;
      teams: TeamRow[];
      teamsByGroup: Record<string, TeamRow[]>;
    }) => {
      setTeams(payload.teams || []);
      setTeamsByGroup(payload.teamsByGroup || {});
      const r = payload.result;
      setWinner(r?.winner_team_code || "");
      const semi = r?.semifinalist_team_codes;
      setSemiFinalists(
        semi && Array.isArray(semi) ? [0, 1, 2, 3].map((i) => String(semi[i] || "")) : ["", "", "", ""]
      );
      const gr = r?.group_results || {};
      const nextGs: Record<string, { first: string; second: string }> = {};
      for (const key of GROUP_LABELS) {
        const row = gr[key];
        const first = typeof row?.first === "string" ? row.first.trim() : "";
        const second = typeof row?.second === "string" ? row.second.trim() : "";
        const f = first;
        let s = second;
        if (f && s && f === s) s = "";
        nextGs[key] = { first: f, second: s };
      }
      setGroupStage(nextGs);
      setTotalGoals(r?.total_goals == null ? "" : String(r.total_goals));
      const topCodes =
        r?.top_scoring_team_codes && r.top_scoring_team_codes.length > 0
          ? r.top_scoring_team_codes
          : r?.top_scoring_team_code
            ? [r.top_scoring_team_code]
            : [];
      setTopScoringTeams(topCodes);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userError || !user) {
        router.replace("/worldcup/admin/login");
        setAuthChecked(true);
        return;
      }

      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmails = envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const ok =
        adminEmails.length > 0 && userEmailLower && adminEmails.includes(userEmailLower);

      if (!ok) {
        router.replace("/worldcup/admin/login");
        setAuthChecked(true);
        return;
      }

      setAllowed(true);
      setAuthChecked(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setLoadError("Not signed in");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/worldcup/admin/competition-results", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          error?: string;
          details?: string;
          teams?: TeamRow[];
          teamsByGroup?: Record<string, TeamRow[]>;
          result?: CompetitionResultRow | null;
        };
        if (!res.ok) {
          setLoadError(json?.details || json?.error || `Request failed (${res.status})`);
          setLoading(false);
          return;
        }
        applyPayload({
          result: json.result ?? null,
          teams: json.teams || [],
          teamsByGroup: json.teamsByGroup || {},
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, applyPayload]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAllowed(false);
    router.replace("/worldcup/login");
  }

  async function handleSave() {
    setSaveError(null);
    setSaveFlash(null);
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setSaveError("Session expired; sign in again.");
        return;
      }

      const totalGoalsValue =
        totalGoals.trim() === "" ? null : Number.parseInt(totalGoals, 10);
      if (totalGoals.trim() !== "" && !Number.isFinite(totalGoalsValue)) {
        setSaveError("Total goals must be a valid integer.");
        return;
      }

      const groupPayload: Record<string, { first: string; second: string }> = {};
      for (const g of GROUP_LABELS) {
        const row = groupStage[g] || { first: "", second: "" };
        const { first } = row;
        let second = row.second;
        if (first && second && first === second) second = "";
        groupPayload[g] = { first, second };
      }

      const res = await fetch("/api/worldcup/admin/competition-results", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winner_team_code: winner || null,
          semifinalist_team_codes: semiFinalists,
          group_results: groupPayload,
          total_goals: totalGoalsValue,
          top_scoring_team_codes: topScoringTeams,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        details?: string;
        ok?: boolean;
        result?: CompetitionResultRow | null;
      };
      if (!res.ok) {
        setSaveError(json?.details || json?.error || "Save failed");
        return;
      }
      if (json.result) {
        applyPayload({
          result: json.result,
          teams,
          teamsByGroup,
        });
      }
      setSaveFlash("Saved");
      window.setTimeout(() => setSaveFlash(null), 2500);
    } catch {
      setSaveError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center overflow-x-hidden text-white"
        style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
      >
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupAdminHeader subtitle="Competition Results" onLogout={handleLogout} />

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
          <h1 className="text-2xl font-semibold text-slate-900">Competition Picks — Actual Results</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter official outcomes for pre-tournament competition picks (winner, semi-finalists,
            group finishing order, tournament stats). Scoring against participants is not applied
            yet.
          </p>

          {saveError ? <p className={`mt-4 ${worldCupFormAlertErrorClass}`}>{saveError}</p> : null}
          {saveFlash ? <p className={`mt-4 ${worldCupFormAlertSuccessClass}`}>{saveFlash}</p> : null}

          {loading ? (
            <p className="mt-8 text-slate-600">Loading…</p>
          ) : loadError ? (
            <p className="mt-8 text-red-600">{loadError}</p>
          ) : (
            <>
              <div className="mt-8 space-y-8">
                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Winner</h2>
                  <select
                    value={winner}
                    onChange={(e) => setWinner(e.target.value)}
                    className={`mt-3 ${worldCupSelectControlClass}`}
                  >
                    <option value="">Select winner</option>
                    {teams.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </section>

                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Semi-finalists</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <select
                        key={idx}
                        value={semiFinalists[idx] || ""}
                        onChange={(e) => {
                          const next = [...semiFinalists];
                          next[idx] = e.target.value;
                          setSemiFinalists(next);
                        }}
                        className={worldCupSelectControlClass}
                      >
                        <option value="">Semi-finalist {idx + 1}</option>
                        {teams.map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                </section>

                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Group results (1st / 2nd)</h2>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    {GROUP_LABELS.map((group) => {
                      const pool = teamsByGroup[group] || [];
                      const row = groupStage[group] || { first: "", second: "" };
                      const firstOptions = pool.filter(
                        (t) => !row.second || t.code !== row.second || t.code === row.first
                      );
                      const secondOptions = pool.filter(
                        (t) => !row.first || t.code !== row.first || t.code === row.second
                      );
                      return (
                        <div key={group} className={worldCupNestedPanelClass}>
                          <p className="text-sm font-semibold text-zinc-800">{group}</p>
                          {pool.length === 0 ? (
                            <p className="mt-2 text-xs text-amber-800">
                              No teams mapped to this group in{" "}
                              <code className="rounded bg-zinc-100 px-1">world_cup_teams.group_name</code>.
                            </p>
                          ) : null}
                          <div className="mt-2 grid gap-2">
                            <select
                              value={row.first}
                              onChange={(e) => {
                                const newFirst = e.target.value;
                                setGroupStage((prev) => {
                                  const cur = prev[group] || { first: "", second: "" };
                                  const next = { ...cur, first: newFirst };
                                  if (newFirst && newFirst === cur.second) next.second = "";
                                  return { ...prev, [group]: next };
                                });
                              }}
                              className={worldCupSelectControlClass}
                            >
                              <option value="">1st place</option>
                              {firstOptions.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={row.second}
                              onChange={(e) => {
                                const newSecond = e.target.value;
                                setGroupStage((prev) => {
                                  const cur = prev[group] || { first: "", second: "" };
                                  const next = { ...cur, second: newSecond };
                                  if (newSecond && newSecond === cur.first) next.first = "";
                                  return { ...prev, [group]: next };
                                });
                              }}
                              className={worldCupSelectControlClass}
                            >
                              <option value="">2nd place</option>
                              {secondOptions.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Tournament stats</h2>
                  <div className="mt-3 grid gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Total goals
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={totalGoals}
                        onChange={(e) => setTotalGoals(e.target.value)}
                        className={worldCupSelectControlClass}
                        placeholder="Total goals"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-zinc-700">
                        Top scoring team(s)
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Select every team tied for most group-stage goals. Participants who picked
                        any selected team receive pool top scorer points.
                      </p>
                      {topScoringTeams.length > 0 ? (
                        <p className="mt-2 text-sm text-zinc-800">
                          Selected:{" "}
                          <span className="font-medium">
                            {topScoringTeams
                              .map((code) => teams.find((t) => t.code === code)?.name || code)
                              .join(", ")}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">No teams selected.</p>
                      )}
                      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-zinc-200 bg-white p-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {teams.map((t) => {
                            const checked = topScoringTeams.includes(t.code);
                            return (
                              <label
                                key={t.code}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setTopScoringTeams((prev) => {
                                      if (e.target.checked) {
                                        return prev.includes(t.code) ? prev : [...prev, t.code];
                                      }
                                      return prev.filter((c) => c !== t.code);
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-zinc-300 text-[#126BFF] focus:ring-[#126BFF]"
                                />
                                <span className="text-zinc-800">{t.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className={worldCupAdminSaveButtonClass}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
