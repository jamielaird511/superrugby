"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  updated_at?: string;
};

function AdminNavTabs() {
  const pathname = usePathname();
  const normalized = pathname.replace(/\/$/, "") || "/";
  const matchActive = normalized === "/worldcup/admin";
  const compActive = normalized.includes("/worldcup/admin/competition-results");
  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? "bg-white/25 text-white" : "text-white/90 hover:bg-white/15"
    }`;
  return (
    <nav className="mt-2 flex flex-wrap gap-2 border-t border-white/20 pt-2">
      <Link href="/worldcup/admin" className={linkClass(matchActive)}>
        Match Results
      </Link>
      <Link href="/worldcup/admin/competition-results" className={linkClass(compActive)}>
        Competition Results
      </Link>
    </nav>
  );
}

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
  const [topScoringTeam, setTopScoringTeam] = useState("");
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
        let f = first;
        let s = second;
        if (f && s && f === s) s = "";
        nextGs[key] = { first: f, second: s };
      }
      setGroupStage(nextGs);
      setTotalGoals(r?.total_goals == null ? "" : String(r.total_goals));
      setTopScoringTeam(r?.top_scoring_team_code || "");
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
        let { first, second } = row;
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
          top_scoring_team_code: topScoringTeam || null,
        }),
      });
      const json = (await res.json()) as { error?: string; details?: string; ok?: boolean };
      if (!res.ok) {
        setSaveError(json?.details || json?.error || "Save failed");
        return;
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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-sky-50 font-sans text-slate-900">
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-[#004765] shadow-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xl font-bold uppercase tracking-wide text-white">
              FIFA World Cup 2026
            </span>
            <span className="text-sm font-medium text-white/80">Admin — competition results</span>
            <AdminNavTabs />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/worldcup/results"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Public results
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-28 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-[#003A5D]">Competition picks — actual results</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter official outcomes for pre-tournament competition picks (winner, semi-finalists,
            group finishing order, tournament stats). Scoring against participants is not applied
            yet.
          </p>

          {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}
          {saveFlash ? <p className="mt-4 text-sm font-medium text-green-700">{saveFlash}</p> : null}

          {loading ? (
            <p className="mt-8 text-slate-600">Loading…</p>
          ) : loadError ? (
            <p className="mt-8 text-red-600">{loadError}</p>
          ) : (
            <>
              <div className="mt-8 space-y-8">
                <section className="rounded-lg border border-zinc-200 p-4">
                  <h2 className="text-base font-semibold text-zinc-900">Winner</h2>
                  <select
                    value={winner}
                    onChange={(e) => setWinner(e.target.value)}
                    className="mt-3 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  >
                    <option value="">Select winner</option>
                    {teams.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </section>

                <section className="rounded-lg border border-zinc-200 p-4">
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
                        className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
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

                <section className="rounded-lg border border-zinc-200 p-4">
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
                        <div key={group} className="rounded-md border border-zinc-200 p-3">
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
                              className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
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
                              className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
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

                <section className="rounded-lg border border-zinc-200 p-4">
                  <h2 className="text-base font-semibold text-zinc-900">Tournament stats</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min={0}
                      value={totalGoals}
                      onChange={(e) => setTotalGoals(e.target.value)}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                      placeholder="Total goals"
                    />
                    <select
                      value={topScoringTeam}
                      onChange={(e) => setTopScoringTeam(e.target.value)}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                    >
                      <option value="">Top scoring team</option>
                      {teams.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </section>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-md bg-[#004765] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#00354d] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
