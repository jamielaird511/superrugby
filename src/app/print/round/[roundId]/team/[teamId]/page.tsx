"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

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
      setFixtures(fixturesData || []);

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
    // If logo_path starts with /, treat as public path
    if (logoPath.startsWith("/")) return logoPath;
    // Otherwise, assume it's a relative path from public
    return logoPath.startsWith("teams/") ? `/${logoPath}` : `/teams/${logoPath}`;
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
          body {
            padding: 0 !important;
            margin: 0 !important;
            font-size: 11px;
            background: white !important;
          }
          .print-container {
            max-width: 100%;
            padding: 0;
          }
          .print-content {
            max-width: 100%;
            margin: 0 auto;
            padding: 8mm 12mm;
          }
          .match-card {
            page-break-inside: avoid;
            break-inside: avoid;
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
          <div className="mb-4 print:mb-2">
            <div className="flex items-center justify-center gap-3 print:gap-2 mb-1.5 print:mb-1">
              <img src="/brand/anz.svg" alt="ANZ" className="h-8 w-auto print:h-6" />
              <img src="/brand/SUP.svg" alt="Super Rugby" className="h-8 w-auto print:h-6" />
            </div>
            <h1 className="text-lg print:text-base font-bold text-black text-center leading-tight print:leading-tight mb-0.5 print:mb-0">
              ANZ Super Rugby Picks Competition
            </h1>
            <div className="text-sm print:text-xs text-black mt-0.5 print:mt-0 text-center leading-tight print:leading-tight">
              Season {round.season} - Round {round.round_number}
            </div>
            <div className="text-xs print:text-[10px] text-black mt-0.5 print:mt-0 text-center leading-tight print:leading-tight">
              Team: {participant.team_name} • Generated: {formatDateGenerated()}
            </div>
          </div>

          {/* Fixture Cards - Matching Main Picks Page Layout */}
          <div className="space-y-3 print:space-y-2">
            {fixtures.map((fixture) => {
              const homeTeam = teams[fixture.home_team_code];
              const awayTeam = teams[fixture.away_team_code];
              const homeName = homeTeam?.name || fixture.home_team_code;
              const awayName = awayTeam?.name || fixture.away_team_code;
              const kickoffStr = formatKickoff(fixture.kickoff_at);
              const pick = picks[fixture.id];
              const pickedTeam = pick ? teams[pick.picked_team] : null;
              const pickedTeamCode = pick?.picked_team || "";
              const marginText = pick && pick.margin > 0 
                ? (pick.margin >= 1 && pick.margin <= 12 ? "1–12" : "13+")
                : null;

              return (
                <div key={fixture.id} className="flex justify-center">
                  <div
                    className="w-full max-w-2xl rounded-md border border-zinc-300 bg-white p-3 print:p-2 match-card"
                    style={{ breakInside: "avoid" }}
                  >
                    {/* Card Header - Matching Main Picks Page */}
                    <div className="mb-2 print:mb-1.5 flex flex-col items-center text-center">
                      <div className="mb-0.5 print:mb-0 font-medium text-black text-sm print:text-xs">
                        {homeName} vs {awayName}
                      </div>
                      {kickoffStr && (
                        <div className="text-xs print:text-[10px] text-zinc-600">
                          {kickoffStr}
                        </div>
                      )}
                    </div>

                    {/* Pick Summary Row - Matching Main Picks Page Locked Summary */}
                    {pick ? (
                      <div className="mx-auto w-full max-w-3xl flex items-center justify-center gap-3 print:gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 print:px-3 py-2 print:py-1.5">
                        {/* Left: Logo/Icon */}
                        <div className="flex items-center">
                          {pick.picked_team === "DRAW" ? (
                            <span className="text-xl print:text-lg font-semibold text-[#004165]" aria-hidden="true">=</span>
                          ) : (
                            <>
                              {pickedTeam?.logo_path ? (
                                <img
                                  src={getTeamLogoUrl(pickedTeam.logo_path, pickedTeamCode)}
                                  alt={pickedTeam.name || pickedTeamCode}
                                  className="h-6 w-6 print:h-5 print:w-5 object-contain"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="text-xs print:text-[10px] font-semibold text-zinc-600">
                                  {pickedTeamCode}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {/* Right: Team Name + Margin */}
                        <span className="font-semibold text-[#004165] text-sm print:text-xs">
                          {pick.picked_team === "DRAW" ? (
                            "Draw"
                          ) : (
                            <>
                              {pickedTeam?.name || pickedTeamCode}
                              {marginText && <> {marginText}</>}
                            </>
                          )}
                        </span>
                      </div>
                    ) : (
                      <div className="mx-auto w-full max-w-3xl flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 px-4 print:px-3 py-2 print:py-1.5">
                        <span className="text-sm print:text-xs text-gray-500 italic">No pick</span>
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
