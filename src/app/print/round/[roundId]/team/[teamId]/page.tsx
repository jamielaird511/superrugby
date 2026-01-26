"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import { calculatePickScore } from "@/lib/scoring";

const TEAM_NAMES: Record<string, string> = {
  BLU: "Blues", BRU: "Brumbies", CHI: "Chiefs", CRU: "Crusaders",
  DRU: "Drua", FOR: "Force", HIG: "Highlanders", HUR: "Hurricanes",
  MOA: "Moana Pasifika", RED: "Reds", WAR: "Waratahs",
};

type Round = {
  id: string;
  season: number;
  round_number: number;
};

type Team = {
  code: string;
  name: string;
  logo_path: string | null;
};

type Fixture = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  round_id: string;
};

type Pick = {
  fixture_id: string;
  picked_team: string;
  margin: number;
};

type FixtureResult = {
  winning_team: string;
  margin_band: string | null;
};

type Participant = {
  id: string;
  name: string;
  team_name: string;
};

export default function PrintRoundTeamPage() {
  const params = useParams();
  const roundId = params.roundId as string;
  const teamId = params.teamId as string;
  const [round, setRound] = useState<Round | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [resultsMap, setResultsMap] = useState<Record<string, FixtureResult>>({});
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetchData();
  }, [roundId, teamId]);

  useEffect(() => {
    if (round && participant) {
      document.title = `ANZ Super Rugby Picks - ${participant.team_name} - Season ${round.season} Round ${round.round_number}`;
    }
  }, [round, participant]);

  const fetchData = async () => {
    try {
      // Get the current session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      // Fetch participant
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id, name, team_name")
        .eq("id", teamId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);

      // Fetch round
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .eq("id", roundId)
        .single();

      if (roundError) throw roundError;
      setRound(roundData);

      // Fetch fixtures
      const { data: fixturesData, error: fixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .order("match_number", { ascending: true });

      if (fixturesError) throw fixturesError;
      const fixturesList = fixturesData || [];
      setFixtures(fixturesList);

      const fixtureIds = fixturesList.map((f: Fixture) => f.id);
      if (fixtureIds.length > 0) {
        const { data: resultsData, error: resultsErr } = await supabase
          .from("fixture_results_public")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds);
        if (!resultsErr && resultsData) {
          const map: Record<string, FixtureResult> = {};
          resultsData.forEach((r: { fixture_id: string; winning_team: string; margin_band: string | null }) => {
            map[r.fixture_id] = { winning_team: r.winning_team, margin_band: r.margin_band };
          });
          setResultsMap(map);
        }
      }

      // Fetch picks for this team and round using authenticated API
      const picksResponse = await fetch(`/api/print?roundId=${roundId}&participantId=${teamId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (picksResponse.ok) {
        const picksData = await picksResponse.json();
        const picksMap: Record<string, Pick> = {};
        (picksData.picks || []).forEach((pick: Pick) => {
          picksMap[pick.fixture_id] = pick;
        });
        setPicks(picksMap);
      }

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("super_rugby_teams")
        .select("code, name, logo_path");

      if (teamsError) throw teamsError;
      const teamsMap: Record<string, Team> = {};
      (teamsData || []).forEach((team) => {
        teamsMap[team.code] = { code: team.code, name: team.name, logo_path: team.logo_path };
      });
      setTeams(teamsMap);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatKickoff = (kickoffAt: string | null) => {
    if (!kickoffAt) return "";
    const date = new Date(kickoffAt);
    const weekday = new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      weekday: "long",
    }).format(date);
    const datePart = new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
    return `${weekday} - ${datePart}, ${timePart}`;
  };

  const formatDateGenerated = () => {
    return new Date().toLocaleDateString("en-NZ", {
      timeZone: "Pacific/Auckland",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getTeamLogoUrl = (logoPath: string | null, teamCode: string): string => {
    if (!logoPath) return `/teams/${teamCode}.svg`;
    if (logoPath.startsWith("/")) return logoPath;
    return logoPath.startsWith("teams/") ? `/${logoPath}` : `/teams/${logoPath}`;
  };

  const formatMarginBand = (pickedTeam: string, margin: number | null | undefined): string => {
    if (pickedTeam === "DRAW") return "DRAW";
    if (margin === 13) return "13+";
    if (margin === 1) return "1–12";
    return "";
  };

  const isFixtureLocked = (kickoffAt: string | null): boolean => {
    if (!kickoffAt) return false;
    return new Date() >= new Date(kickoffAt);
  };

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="p-8">
        <p>Please login to view/print picks.</p>
      </div>
    );
  }

  if (!round || !participant) {
    return (
      <div className="p-8">
        <p>Round or team not found</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          footer {
            display: none !important;
          }
          button {
            display: none !important;
          }
          body {
            padding: 0 !important;
            margin: 0 !important;
            font-size: 11px;
            background: white !important;
          }
          .print-container {
            max-width: 100%;
            padding: 0;
            width: 100%;
          }
          .print-content {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 6mm 10mm;
          }
          .print-compact-header h1 {
            font-size: 13px !important;
            line-height: 1.2 !important;
          }
          .print-compact-header .print-sub {
            font-size: 11px !important;
            margin-top: 1px !important;
          }
          .print-compact-header .print-logo-row {
            gap: 6px !important;
            margin-bottom: 2px !important;
          }
          .print-compact-header .print-logo-row img {
            height: 18px !important;
            width: auto !important;
          }
          .match-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-shadow: none !important;
          }
          @page {
            margin: 10mm;
            size: A4;
          }
        }
        @media screen {
          .print-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            background: white;
            min-h-screen;
          }
          .print-content {
            max-width: 672px;
            margin: 0 auto;
          }
        }
      `}</style>
      <div className="print-container bg-white">
        <div className="print-content">
          <div className="mb-6 no-print">
            <button
              onClick={() => window.print()}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Print
            </button>
          </div>

          {/* Compact Header */}
          <div className="print-compact-header mb-4 print:mb-1.5">
            <div className="print-logo-row flex items-center justify-center gap-3 print:gap-2 mb-1.5 print:mb-0">
              <img src="/brand/anz.svg" alt="ANZ" className="h-8 w-auto print:h-5" />
              <img src="/brand/SUP.svg" alt="Super Rugby" className="h-8 w-auto print:h-5" />
            </div>
            <h1 className="text-lg print:text-sm font-bold text-black text-center leading-tight mb-0.5 print:mb-0">
              ANZ Super Rugby Picks Competition
            </h1>
            <div className="print-sub text-sm print:text-xs text-black mt-0.5 text-center leading-tight">
              Season {round.season} - Round {round.round_number}
            </div>
            <div className="print-sub text-xs print:text-[10px] text-black mt-0.5 text-center leading-tight">
              Team: {participant.team_name} • Generated: {formatDateGenerated()}
            </div>
          </div>

          {/* Fixture Cards - Audit sheet: FINAL / LOCKED / OPEN */}
          <div className="space-y-3 print:space-y-0.5">
            {fixtures.map((fixture) => {
              const homeTeam = teams[fixture.home_team_code];
              const awayTeam = teams[fixture.away_team_code];
              const homeName = homeTeam?.name || TEAM_NAMES[fixture.home_team_code] || fixture.home_team_code;
              const awayName = awayTeam?.name || TEAM_NAMES[fixture.away_team_code] || fixture.away_team_code;
              const kickoffStr = formatKickoff(fixture.kickoff_at);
              const pick = picks[fixture.id];
              const result = resultsMap[fixture.id];
              const hasResult = !!result;
              const isLocked = isFixtureLocked(fixture.kickoff_at);
              const pickedTeam = pick ? teams[pick.picked_team] : null;
              const pickedTeamCode = pick?.picked_team || "";
              const marginText = pick ? formatMarginBand(pick.picked_team, pick.margin) : "";
              const nameOrCode = (code: string) => teams[code]?.name || TEAM_NAMES[code] || code;

              const pickRow = (
                <div className="flex items-center gap-3">
                  {pick?.picked_team === "DRAW" ? (
                    <span className="text-xl print:text-lg font-semibold text-[#004165]" aria-hidden="true">=</span>
                  ) : (
                    pickedTeam?.logo_path ? (
                      <img
                        src={getTeamLogoUrl(pickedTeam.logo_path, pickedTeamCode)}
                        alt={pickedTeam.name || pickedTeamCode}
                        className="h-6 w-6 print:h-5 print:w-5 object-contain flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-xs print:text-[10px] font-semibold text-zinc-600">{pickedTeamCode}</span>
                    )
                  )}
                  <span className="font-semibold text-[#004165] text-sm print:text-xs">
                    {pick?.picked_team === "DRAW" ? "Draw" : (
                      <>{nameOrCode(pickedTeamCode)}{marginText ? ` ${marginText}` : ""}</>
                    )}
                  </span>
                </div>
              );

              const noPickLocked = (
                <div className="text-center">
                  <div className="font-semibold text-zinc-700 text-sm print:text-xs">No Pick Made</div>
                  <div className="mt-1 text-xs text-zinc-500">Pick Window Closed</div>
                </div>
              );

              const noPickOpen = (
                <div className="text-center">
                  <div className="font-semibold text-zinc-700 text-sm print:text-xs">No Pick Made</div>
                </div>
              );

              const containerClass = "mb-2 print:mb-0.5 mx-auto w-full max-w-xl flex items-center justify-center gap-4 print:gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 print:px-2.5 py-2 print:py-1.5";

              return (
                <div key={fixture.id} className="flex justify-center">
                  <div
                    className="w-full max-w-2xl rounded-md border border-zinc-300 bg-white p-3 print:py-2 print:px-3 match-card"
                    style={{ breakInside: "avoid" }}
                  >
                    <div className="mb-2 print:mb-0.5 flex flex-col items-center text-center">
                      <div className="mb-0.5 print:mb-0 font-medium text-black text-sm print:text-xs">
                        {homeName} vs {awayName}
                      </div>
                      {kickoffStr && (
                        <div className="text-xs print:text-[10px] text-zinc-600">{kickoffStr}</div>
                      )}
                    </div>

                    {hasResult ? (
                      <div className="mb-2 print:mb-0.5 mx-auto w-full max-w-xl grid grid-cols-[1fr_auto] items-center gap-4 print:gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 print:px-2.5 py-2 print:py-1.5">
                        <div className="flex min-w-0 items-center gap-3">
                          {pick ? (
                            <>
                              {pick.picked_team === "DRAW" ? (
                                <span className="text-xl print:text-lg font-semibold text-[#004165]" aria-hidden="true">=</span>
                              ) : pickedTeam?.logo_path ? (
                                <img
                                  src={getTeamLogoUrl(pickedTeam.logo_path, pickedTeamCode)}
                                  alt={pickedTeam.name || pickedTeamCode}
                                  className="h-6 w-6 print:h-5 print:w-5 object-contain flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <span className="text-xs print:text-[10px] font-semibold text-zinc-600">{pickedTeamCode}</span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[#004165] text-sm print:text-xs">
                                  {pick.picked_team === "DRAW" ? "Draw" : <>{nameOrCode(pickedTeamCode)}{marginText ? ` ${marginText}` : ""}</>}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  Final result: {result!.winning_team === "DRAW" ? "Draw" : nameOrCode(result!.winning_team)}
                                  {result!.margin_band ? ` ${result!.margin_band}` : ""}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[#004165] text-sm print:text-xs">No Pick Made</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Final result: {result!.winning_team === "DRAW" ? "Draw" : nameOrCode(result!.winning_team)}
                                {result!.margin_band ? ` ${result!.margin_band}` : ""}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="w-14 flex flex-col items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 print:py-1">
                          <span className="text-lg font-bold leading-none text-zinc-900 print:text-base">
                            {pick ? calculatePickScore(pick.picked_team, pick.margin, result!).totalPoints : 0}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500">PTS</span>
                        </div>
                      </div>
                    ) : (
                      <div className={containerClass}>
                        {pick ? pickRow : (isLocked ? noPickLocked : noPickOpen)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
