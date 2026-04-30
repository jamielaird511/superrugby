"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";

const STORAGE_KEY = "worldcup_participant_id";

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

export default function WorldCupResultsPage() {
  const [rounds, setRounds] = useState<RoundSection[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantPath, setParticipantPath] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const id = localStorage.getItem(STORAGE_KEY);
      setParticipantPath(id ? `/worldcup/team/${id}` : null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/worldcup/results");
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
        if (!cancelled) {
          setRounds(json.rounds || []);
          setLeaderboard(json.leaderboard || []);
          setTeamNames(json.teamNames || {});
        }
      } catch {
        if (!cancelled) setError("Failed to load results");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-sky-50 font-sans text-slate-900">
      <WorldCupHeader subtitle="Results" />

      <main className="mx-auto max-w-5xl px-4 pb-8 pt-28 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-[#003A5D]">Match results</h1>
          <p className="mt-2 text-sm text-slate-600">
            Final scores recorded for the FIFA World Cup 2026 picks competition.
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
      </main>
    </div>
  );
}
