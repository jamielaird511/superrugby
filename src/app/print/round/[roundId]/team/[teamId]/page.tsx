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

      // Fetch picks for this team and round
      const picksResponse = await fetch(`/api/picks?participantId=${teamId}`);
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
          }
          .print-container {
            max-width: 100%;
            padding: 0;
          }
          .print-content {
            max-width: 180mm;
            margin: 0 auto;
            padding: 8mm 10mm;
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
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
          }
        }
      `}</style>
      <div className="print-container">
        <div className="print-content">
          <div className="mb-6 no-print">
            <button
              onClick={() => window.print()}
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Print
            </button>
          </div>

          <div className="mb-4 print:mb-3">
            <div className="flex items-center justify-center gap-4 print:gap-3 mb-2 print:mb-1">
              <img src="/brand/anz.svg" alt="ANZ" className="h-9 w-auto print:h-7" />
              <img src="/brand/SUP.svg" alt="Super Rugby" className="h-9 w-auto print:h-7" />
            </div>
            <div className="text-[10px] print:text-[9px] text-gray-400 text-center mb-0.5 print:mb-0">
              MY PICKS PRINT v2
            </div>
            <h1 className="text-xl print:text-lg font-bold text-black text-center leading-tight print:leading-tight mb-0.5 print:mb-0">
              ANZ Super Rugby Picks Competition
            </h1>
            <div className="text-base print:text-sm text-black mt-0.5 print:mt-0 text-center leading-tight print:leading-tight">
              Season {round.season} - Round {round.round_number}
            </div>
            <div className="text-sm print:text-xs text-black mt-0.5 print:mt-0 text-center leading-tight print:leading-tight">
              Team: {participant.team_name}
            </div>
            <div className="text-xs print:text-[10px] text-black mt-0.5 print:mt-0 text-center leading-tight print:leading-tight">
              Generated: {formatDateGenerated()}
            </div>
          </div>

          <div className="space-y-2 print:space-y-1.5">
          {fixtures.map((fixture) => {
            const homeTeam = teams[fixture.home_team_code];
            const awayTeam = teams[fixture.away_team_code];
            const homeName = homeTeam?.name || fixture.home_team_code;
            const awayName = awayTeam?.name || fixture.away_team_code;
            const kickoffStr = formatKickoff(fixture.kickoff_at);
            const homeLogoPath = getTeamLogoUrl(homeTeam?.logo_path || null, fixture.home_team_code);
            const awayLogoPath = getTeamLogoUrl(awayTeam?.logo_path || null, fixture.away_team_code);
            const pick = picks[fixture.id];
            const pickedTeam = pick ? teams[pick.picked_team] : null;
            const pickedTeamCode = pick?.picked_team || "";
            const marginText = pick && pick.margin > 0 
              ? (pick.margin >= 1 && pick.margin <= 12 ? "1–12" : "13+")
              : null;

            return (
              <div key={fixture.id} className="border border-zinc-300 rounded-md p-2 print:p-1.5 bg-white match-card" style={{ breakInside: "avoid" }}>
                <div className="grid grid-cols-[1fr_auto] gap-3 print:gap-2 items-center">
                  {/* LEFT COLUMN: Match Info */}
                  <div>
                    <div className="text-sm print:text-[12px] font-semibold print:font-medium text-black leading-tight print:leading-tight">
                      {homeName} vs {awayName}
                    </div>
                    {kickoffStr && (
                      <div className="text-xs print:text-[10px] text-zinc-600 mt-0.5 print:mt-0 leading-tight print:leading-tight">
                        {kickoffStr}
                      </div>
                    )}
                  </div>

                  {/* RIGHT COLUMN: Pick */}
                  <div className="flex items-center">
                    {pick ? (
                      <div className="flex items-center gap-1.5 print:gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 print:px-1.5 py-1 print:py-0.5 h-7 print:h-6">
                        {/* Logo/Icon */}
                        {pick.picked_team === "DRAW" ? (
                          <span className="text-lg print:text-base font-semibold text-[#004165]" aria-hidden="true">=</span>
                        ) : (
                          <>
                            {pickedTeam?.logo_path ? (
                              <img
                                src={getTeamLogoUrl(pickedTeam.logo_path, pickedTeamCode)}
                                alt={pickedTeam.name || pickedTeamCode}
                                className="h-5 w-5 print:h-4 print:w-4 object-contain flex-shrink-0"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-xs print:text-[10px] font-semibold text-zinc-600 flex-shrink-0">{pickedTeamCode}</span>
                            )}
                          </>
                        )}
                        {/* Team Name + Margin */}
                        <span className="text-xs print:text-[10px] font-semibold text-[#004165] whitespace-nowrap">
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
                      <div className="flex items-center rounded border border-zinc-300 bg-zinc-50 px-2 print:px-1.5 py-1 print:py-0.5 h-7 print:h-6">
                        <span className="text-xs print:text-[10px] text-gray-500 italic">No pick</span>
                      </div>
                    )}
                  </div>
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
