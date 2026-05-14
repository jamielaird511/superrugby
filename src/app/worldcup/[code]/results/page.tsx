"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { notFound, useParams } from "next/navigation";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupContentCardClass,
  worldCupDataTableWrapClass,
  worldCupEmptyStateBoxClass,
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

type LeaderboardBreakdown = {
  match_picks: number;
  pool_positions: number;
  semifinalists: number;
  pool_top_attacking: number;
  total_goals: number;
  winner: number;
  total: number;
};

type LeaderboardRow = {
  participant_id: string;
  team_name: string;
  points: number;
  breakdown: LeaderboardBreakdown;
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

function LeaderboardBreakdownPanel({ b }: { b: LeaderboardBreakdown }) {
  const lines: { label: string; pts: number }[] = [
    { label: "Match results", pts: b.match_picks },
    { label: "Group order", pts: b.pool_positions },
    { label: "Semi-finalists", pts: b.semifinalists },
    { label: "Pool top scorer", pts: b.pool_top_attacking },
    { label: "Total goals", pts: b.total_goals },
    { label: "Winner", pts: b.winner },
  ];
  return (
    <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-1">
      {lines.map((line) => (
        <div key={line.label} className="flex justify-between gap-4 leading-snug">
          <span className="min-w-0 text-zinc-600">{line.label}:</span>
          <span className="shrink-0 tabular-nums font-medium text-zinc-900">{line.pts}</span>
        </div>
      ))}
      <div className="col-span-1 mt-1 flex justify-between gap-4 border-t border-zinc-300 pt-1.5 font-semibold leading-snug sm:col-span-2">
        <span className="text-zinc-800">Total:</span>
        <span className="shrink-0 tabular-nums font-bold text-[#0B5CAD]">{b.total}</span>
      </div>
    </div>
  );
}

function LeaderboardScoringKey() {
  const items = [
    "Match: 5 pts per correct result",
    "Group 1st/2nd: 15 pts each",
    "Semi-finalist: 20 pts each",
    "Pool top scorer: 25 pts",
    "Total goals: 40 closest; +10 exact; +10 within 10",
    "Winner: 50 pts",
  ];
  return (
    <div className="mb-3 border border-zinc-300 bg-zinc-50 px-2.5 py-2 text-xs leading-tight text-zinc-700">
      <p className="font-semibold uppercase tracking-wide text-zinc-600">Scoring key</p>
      <div className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <p key={t} className="border-l-2 border-zinc-300 pl-2">
            {t}
          </p>
        ))}
      </div>
    </div>
  );
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
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/worldcup/results?tenant=${tenant.slug}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as {
        rounds?: RoundSection[];
        leaderboard?: (Omit<LeaderboardRow, "breakdown"> & { breakdown?: LeaderboardBreakdown })[];
        teamNames?: Record<string, string>;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Failed to load results");
        return;
      }
      setError(null);
      setRounds(json.rounds || []);
      const rawLb = json.leaderboard || [];
      setLeaderboard(
        rawLb.map((row) => ({
          ...row,
          breakdown: row.breakdown ?? {
            match_picks: 0,
            pool_positions: 0,
            semifinalists: 0,
            pool_top_attacking: 0,
            total_goals: 0,
            winner: 0,
            total: row.points ?? 0,
          },
        }))
      );
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
            <h1 className="text-2xl font-semibold text-[#003A5D]">Results & Leaderboard</h1>
            <p className="mt-2 text-sm text-slate-600">
              Track match results, leaderboard points, and competition-pick scoring.
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
                    <p className={worldCupEmptyStateBoxClass}>
                      No participants in this league yet.
                    </p>
                  ) : (
                    <div className={worldCupDataTableWrapClass}>
                      <LeaderboardScoringKey />
                      <table className="min-w-full border-collapse border border-zinc-300 bg-white text-sm">
                        <thead className="border-b border-zinc-300 bg-zinc-50">
                          <tr>
                            <th className="w-12 whitespace-nowrap border-b border-zinc-300 px-1 py-1.5 text-left text-xs font-semibold text-zinc-800">
                              #
                            </th>
                            <th className="min-w-[180px] border-b border-zinc-300 px-2 py-1.5 text-left text-xs font-semibold text-zinc-800 sm:min-w-[240px]">
                              Player
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Correct match result (home, draw, or away): 5 pts each"
                            >
                              <span className="block">Match</span>
                              <span className="block font-normal text-zinc-500">results</span>
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Correct group 1st and 2nd: 15 pts each"
                            >
                              <span className="block">Group</span>
                              <span className="block font-normal text-zinc-500">order</span>
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Each correct semi-finalist: 20 pts"
                            >
                              Semis
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Pool top scorer (group stage): 25 pts if correct"
                            >
                              <span className="block">Pool</span>
                              <span className="block font-normal text-zinc-500">scorer</span>
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Total goals prediction: up to 60 pts (see scoring key)"
                            >
                              Goals
                            </th>
                            <th
                              className="w-11 border-b border-zinc-300 px-0.5 py-1.5 text-center text-[10px] font-semibold leading-tight text-zinc-800 sm:w-12 sm:text-xs"
                              title="Tournament winner: 50 pts if correct"
                            >
                              Winner
                            </th>
                            <th className="w-[3.25rem] whitespace-nowrap border-b border-zinc-300 px-1 py-1.5 text-right text-xs font-semibold text-zinc-800 sm:w-14">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {leaderboard.map((row, idx) => {
                            const b = row.breakdown;
                            const open = expandedParticipantId === row.participant_id;
                            const panelId = `wc-lb-breakdown-${row.participant_id}`;
                            const toggle = () =>
                              setExpandedParticipantId((cur) =>
                                cur === row.participant_id ? null : row.participant_id
                              );
                            const stripe = idx % 2 === 1 ? "bg-zinc-50/60" : "bg-white";
                            return (
                              <Fragment key={row.participant_id}>
                                <tr
                                  onClick={toggle}
                                  className={`cursor-pointer border-0 hover:bg-zinc-100/80 ${stripe} ${
                                    open ? "bg-zinc-100/90" : ""
                                  }`}
                                >
                                  <td className="w-12 whitespace-nowrap px-1 py-1.5 tabular-nums text-zinc-900">
                                    {idx + 1}
                                  </td>
                                  <td className="min-w-[180px] px-2 py-1.5 align-top text-zinc-900 sm:min-w-[240px]">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                      <span className="min-w-0 max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-snug sm:max-w-none sm:overflow-visible sm:whitespace-normal sm:break-words">
                                        {row.team_name}
                                      </span>
                                      <button
                                        type="button"
                                        id={`${panelId}-trigger`}
                                        className="touch-manipulation self-start rounded border border-transparent px-2 py-1.5 text-left text-[11px] font-medium text-[#0B5CAD] underline decoration-[#0B5CAD]/35 underline-offset-2 hover:bg-zinc-200/60 hover:decoration-[#0B5CAD] sm:shrink-0 sm:px-1.5 sm:py-0.5 sm:text-xs"
                                        aria-expanded={open}
                                        aria-controls={panelId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggle();
                                        }}
                                      >
                                        {open ? "Hide" : "Details"}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.match_picks}
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.pool_positions}
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.semifinalists}
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.pool_top_attacking}
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.total_goals}
                                  </td>
                                  <td className="w-11 whitespace-nowrap px-0.5 py-1.5 text-center tabular-nums text-zinc-800 sm:w-12">
                                    {b.winner}
                                  </td>
                                  <td className="w-[3.25rem] whitespace-nowrap px-1 py-1.5 text-right text-sm font-bold tabular-nums text-[#0B5CAD] sm:w-14 sm:text-base">
                                    {row.points}
                                  </td>
                                </tr>
                                {open ? (
                                  <tr className="border-0 bg-zinc-50/90 hover:bg-transparent">
                                    <td
                                      colSpan={9}
                                      id={panelId}
                                      role="region"
                                      aria-labelledby={`${panelId}-trigger`}
                                      className="border-t border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-800"
                                    >
                                      <LeaderboardBreakdownPanel b={b} />
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-zinc-500">
                        Tap a row or <span className="font-medium text-zinc-600">Details</span> for a
                        per-player breakdown.
                      </p>
                    </div>
                  )}
                </section>

                {rounds.length === 0 ? (
                  <p className={worldCupEmptyStateBoxClass}>
                    No recorded results yet for this competition.
                  </p>
                ) : (
                  rounds.map((round) => (
                    <section key={round.id}>
                      <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-semibold text-[#003A5D]">
                        {round.label}
                      </h2>
                      <div className={worldCupDataTableWrapClass}>
                        <table className="min-w-full border-collapse border border-zinc-300 bg-white">
                          <thead className="border-b border-zinc-300 bg-zinc-50">
                            <tr>
                              <th className="border-b border-zinc-300 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Match
                              </th>
                              <th className="border-b border-zinc-300 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Fixture
                              </th>
                              <th className="border-b border-zinc-300 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Kickoff (NZ)
                              </th>
                              <th className="border-b border-zinc-300 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                                Result
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {round.fixtures.map((f, fIdx) => (
                              <tr
                                key={f.id}
                                className={`hover:bg-zinc-100/80 ${fIdx % 2 === 1 ? "bg-zinc-50/50" : "bg-white"}`}
                              >
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
