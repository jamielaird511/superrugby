"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";

const STORAGE_KEY = "worldcup_participant_id";

type WorldCupTeamRow = {
  code: string;
  name: string;
  group_name?: string | null;
  flag_emoji?: string | null;
  flag_url?: string | null;
};

type CompetitionPicksState = {
  winner: string;
  semiFinalists: string[];
  groupStage: Record<string, { first: string; second: string }>;
  totalGoals: string;
  topScoringTeam: string;
};

function emptyPicks(): CompetitionPicksState {
  return {
    winner: "",
    semiFinalists: ["", "", "", ""],
    groupStage: {},
    totalGoals: "",
    topScoringTeam: "",
  };
}

function getGroupLabel(row: WorldCupTeamRow): string {
  const raw = row.group_name;
  const normalized = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!normalized) return "Ungrouped";
  if (/^group\s/i.test(normalized)) return normalized;
  return `Group ${normalized}`;
}

export default function WorldCupCompetitionPicksPage() {
  const params = useParams();
  const router = useRouter();
  const routeParticipantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [teamsByGroup, setTeamsByGroup] = useState<Record<string, { code: string; name: string }[]>>({});
  const [allTeams, setAllTeams] = useState<{ code: string; name: string }[]>([]);
  const [picks, setPicks] = useState<CompetitionPicksState>(emptyPicks);
  const [readyToAutosave, setReadyToAutosave] = useState(false);

  const groupNames = useMemo(
    () => Object.keys(teamsByGroup).sort((a, b) => a.localeCompare(b)),
    [teamsByGroup]
  );

  const completion = useMemo(() => {
    const groupStageCompleted = groupNames.reduce((count, group) => {
      const row = picks.groupStage[group];
      if (!row) return count;
      return count + (row.first ? 1 : 0) + (row.second ? 1 : 0);
    }, 0);
    const completed =
      (picks.winner ? 1 : 0) +
      picks.semiFinalists.filter(Boolean).length +
      groupStageCompleted +
      (picks.totalGoals ? 1 : 0) +
      (picks.topScoringTeam ? 1 : 0);
    const total = 1 + 4 + groupNames.length * 2 + 2;
    return { completed, total };
  }, [groupNames, picks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (!storedId || storedId !== routeParticipantId) {
        router.replace("/worldcup/login");
        return;
      }

      try {
        const [teamsRes, picksRes] = await Promise.all([
          supabase
            .from("world_cup_teams")
            .select("code, name, group_name, flag_emoji, flag_url")
            .order("code", { ascending: true }),
          fetch(
            `/api/worldcup/competition-picks?participantId=${encodeURIComponent(routeParticipantId)}`,
            { cache: "no-store" }
          ),
        ]);

        if (teamsRes.error) throw new Error(teamsRes.error.message || "Failed to load teams");
        if (!picksRes.ok) throw new Error("Failed to load saved competition picks");

        const picksJson = (await picksRes.json()) as {
          picks?: {
            winner_team_code?: string | null;
            semifinalist_team_codes?: string[] | null;
            group_picks?: Record<string, { first?: string; second?: string }> | null;
            total_goals?: number | null;
            top_scoring_team_code?: string | null;
          } | null;
          locked?: boolean;
        };
        if (!cancelled) setLocked(Boolean(picksJson.locked));

        const grouped: Record<string, { code: string; name: string }[]> = {};
        const teamList: { code: string; name: string }[] = [];
        for (const row of (teamsRes.data || []) as WorldCupTeamRow[]) {
          const code = String(row.code || "").trim();
          if (!code) continue;
          const name = String(row.name || code).trim() || code;
          const group = getGroupLabel(row);
          if (!grouped[group]) grouped[group] = [];
          grouped[group].push({ code, name });
          teamList.push({ code, name });
        }
        for (const group of Object.keys(grouped)) {
          grouped[group].sort((a, b) => a.name.localeCompare(b.name));
        }
        teamList.sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setTeamsByGroup(grouped);
          setAllTeams(teamList);
        }

        const saved = picksJson.picks;
        if (!cancelled && saved) {
          setPicks({
            winner: saved.winner_team_code || "",
            semiFinalists:
              saved.semifinalist_team_codes && Array.isArray(saved.semifinalist_team_codes)
                ? [0, 1, 2, 3].map((i) => String(saved.semifinalist_team_codes?.[i] || ""))
                : ["", "", "", ""],
            groupStage: saved.group_picks || {},
            totalGoals: saved.total_goals == null ? "" : String(saved.total_goals),
            topScoringTeam: saved.top_scoring_team_code || "",
          });
        }
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : "Failed to load form");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReadyToAutosave(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeParticipantId, router]);

  useEffect(() => {
    if (!readyToAutosave || locked) return;
    const timer = window.setTimeout(async () => {
      setSaveMessage(null);
      try {
        const totalGoalsValue =
          picks.totalGoals.trim() === "" ? null : Number.parseInt(picks.totalGoals, 10);
        const res = await fetch("/api/worldcup/competition-picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: routeParticipantId,
            winner_team_code: picks.winner || null,
            semifinalist_team_codes: picks.semiFinalists,
            group_picks: picks.groupStage,
            total_goals: totalGoalsValue,
            top_scoring_team_code: picks.topScoringTeam || null,
          }),
        });
        const json = (await res.json()) as { error?: string; locked?: boolean };
        if (!res.ok) {
          setSaveMessage(json.error || "Failed to save competition picks");
          if (json.locked) setLocked(true);
          return;
        }
      } catch {
        setSaveMessage("Failed to save competition picks");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [locked, picks, readyToAutosave, routeParticipantId]);

  useEffect(() => {
    setPicks((prev) => {
      let changed = false;
      const gs = { ...prev.groupStage };
      for (const g of Object.keys(gs)) {
        const r = gs[g];
        if (r?.first && r?.second && r.first === r.second) {
          gs[g] = { first: r.first, second: "" };
          changed = true;
        }
      }
      return changed ? { ...prev, groupStage: gs } : prev;
    });
  }, [picks.groupStage]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading competition picks…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-sky-50 font-sans text-slate-900">
      <WorldCupHeader subtitle="Competition Picks" initialParticipantId={routeParticipantId} />

      <main className="mx-auto max-w-5xl px-4 pb-8 pt-28 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-[#003A5D]">Competition Picks</h1>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
              {completion.completed}/{completion.total} completed
            </span>
          </div>

          {locked ? (
            <p className="mt-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
              Competition picks are locked after first kickoff.
            </p>
          ) : null}
          {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
          {saveMessage ? <p className="mt-2 text-sm text-red-600">{saveMessage}</p> : null}

          <div className="mt-6 space-y-6">
            <section className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Winner</h2>
              <select
                disabled={locked}
                value={picks.winner}
                onChange={(e) => setPicks((prev) => ({ ...prev, winner: e.target.value }))}
                className="mt-3 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
              >
                <option value="">Select winner</option>
                {allTeams.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </section>

            <section className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Semi-finalists (max 4)</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((idx) => (
                  <select
                    key={idx}
                    disabled={locked}
                    value={picks.semiFinalists[idx] || ""}
                    onChange={(e) =>
                      setPicks((prev) => {
                        const next = [...prev.semiFinalists];
                        next[idx] = e.target.value;
                        return { ...prev, semiFinalists: next };
                      })
                    }
                    className="h-10 rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
                  >
                    <option value="">Semi-finalist {idx + 1}</option>
                    {allTeams.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Group stage (top 2 per group)</h2>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {groupNames.map((group) => {
                  const teams = teamsByGroup[group] || [];
                  const row = picks.groupStage[group] || { first: "", second: "" };
                  const firstOptions = teams.filter(
                    (t) =>
                      !row.second || t.code !== row.second || t.code === row.first
                  );
                  const secondOptions = teams.filter(
                    (t) => !row.first || t.code !== row.first || t.code === row.second
                  );
                  return (
                    <div key={group} className="rounded-md border border-zinc-200 p-3">
                      <p className="text-sm font-semibold text-zinc-800">{group}</p>
                      <div className="mt-2 grid gap-2">
                        <select
                          disabled={locked}
                          value={row.first}
                          onChange={(e) => {
                            const newFirst = e.target.value;
                            setPicks((prev) => {
                              const cur = prev.groupStage[group] || { first: "", second: "" };
                              const next = { ...cur, first: newFirst };
                              if (newFirst && newFirst === cur.second) {
                                next.second = "";
                              }
                              return {
                                ...prev,
                                groupStage: { ...prev.groupStage, [group]: next },
                              };
                            });
                          }}
                          className="h-10 rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
                        >
                          <option value="">1st place</option>
                          {firstOptions.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <select
                          disabled={locked}
                          value={row.second}
                          onChange={(e) => {
                            const newSecond = e.target.value;
                            setPicks((prev) => {
                              const cur = prev.groupStage[group] || { first: "", second: "" };
                              const next = { ...cur, second: newSecond };
                              if (newSecond && newSecond === cur.first) {
                                next.first = "";
                              }
                              return {
                                ...prev,
                                groupStage: { ...prev.groupStage, [group]: next },
                              };
                            });
                          }}
                          className="h-10 rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
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
                  disabled={locked}
                  value={picks.totalGoals}
                  onChange={(e) => setPicks((prev) => ({ ...prev, totalGoals: e.target.value }))}
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
                  placeholder="Total goals"
                />
                <select
                  disabled={locked}
                  value={picks.topScoringTeam}
                  onChange={(e) => setPicks((prev) => ({ ...prev, topScoringTeam: e.target.value }))}
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
                >
                  <option value="">Top scoring team</option>
                  {allTeams.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
