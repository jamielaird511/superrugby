"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupContentCardClass,
  worldCupMainContentShellClass,
} from "@/lib/worldCupBranding";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";

type FixtureResult = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  winning_team: string;
  home_goals: number;
  away_goals: number;
};

type RoundSection = {
  id: string;
  label: string;
  season: number;
  round_number: number;
  fixtures: FixtureResult[];
};

type LeaderboardRow = {
  participant_id: string;
  team_name: string;
  points: number;
};

function formatKickoffNz(kickoffAt: string | null) {
  if (!kickoffAt) return "—";
  return new Date(kickoffAt).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function teamLabel(code: string, teamNames: Record<string, string>) {
  return teamNames[code.trim().toUpperCase()] || code;
}

function resultSummary(
  teamNames: Record<string, string>,
  homeGoals: number,
  awayGoals: number,
  homeCode: string,
  awayCode: string
) {
  const left = teamLabel(homeCode, teamNames);
  const right = teamLabel(awayCode, teamNames);
  return `${left} ${homeGoals} – ${awayGoals} ${right}`;
}

export default function WorldCupTenantResultsPage() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : "";
  const tenant = useMemo(() => resolveWorldCupTenant(code), [code]);
  if (!tenant) notFound();

  const [rounds, setRounds] = useState<RoundSection[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/worldcup/results?tenant=${tenant.slug}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        rounds?: RoundSection[];
        leaderboard?: LeaderboardRow[];
        teamNames?: Record<string, string>;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Failed to load results");
        return;
      }
      setError(null);
      setRounds(json.rounds || []);
      setLeaderboard(json.leaderboard || []);
      setTeamNames(json.teamNames || {});
    } catch {
      setError("Failed to load results");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void fetchResults();
    const intervalId = window.setInterval(() => {
      void fetchResults();
    }, 5000);
    const onFocus = () => {
      void fetchResults();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchResults]);

  if (!tenant) return null;

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader subtitle="Results" tenantSlug={tenant.slug} />

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
            <h1 className="text-2xl font-semibold text-[#003A5D]">Match results</h1>
            <p className="mt-2 text-sm text-slate-600">
              Final scores recorded for the {tenant.displayName} picks competition.
            </p>

            {loading ? (
              <p className="mt-8 text-slate-600">Loading results…</p>
            ) : error ? (
              <p className="mt-8 text-red-600">{error}</p>
            ) : (
              <div className="mt-8 space-y-10">
                <section>
                  <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-semibold text-[#003A5D]">
                    Leaderboard
                  </h2>
                  {leaderboard.length === 0 ? (
                    <p className="rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                      Leaderboard will appear once matches have results.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-zinc-300">
                      <table className="min-w-full divide-y divide-zinc-200 bg-white">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Rank
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Team
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Points
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {leaderboard.map((row, idx) => (
                            <tr key={row.participant_id} className="hover:bg-zinc-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                                {row.team_name}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-zinc-900">
                                {row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {rounds.length === 0 ? (
                  <p className="rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No recorded results yet for this competition.
                  </p>
                ) : (
                  rounds.map((round) => (
                    <section key={round.id}>
                      <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-semibold text-[#003A5D]">
                        {round.label}
                      </h2>
                      <div className="overflow-x-auto rounded-md border border-zinc-300">
                        <table className="min-w-full divide-y divide-zinc-200 bg-white">
                          <thead className="bg-zinc-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Match
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Fixture
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Kickoff (NZ)
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Result
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {round.fixtures.map((f) => (
                              <tr key={f.id} className="hover:bg-zinc-50">
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900">
                                  {f.match_number}
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-900">
                                  <span className="font-medium">
                                    {teamLabel(f.home_team_code, teamNames)}
                                  </span>
                                  <span className="text-zinc-500"> vs </span>
                                  <span className="font-medium">
                                    {teamLabel(f.away_team_code, teamNames)}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                                  {formatKickoffNz(f.kickoff_at)}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                                  {resultSummary(
                                    teamNames,
                                    f.home_goals,
                                    f.away_goals,
                                    f.home_team_code,
                                    f.away_team_code
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
