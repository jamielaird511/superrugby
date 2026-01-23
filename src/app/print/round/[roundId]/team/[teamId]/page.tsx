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
        .select("code, name");

      if (teamsError) throw teamsError;
      const teamsMap: Record<string, Team> = {};
      (teamsData || []).forEach((team) => {
        teamsMap[team.code] = team;
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
          }
          .print-container {
            max-width: 100%;
            padding: 0;
          }
          .print-content {
            max-width: 180mm;
            margin: 0 auto;
            padding: 15mm 10mm;
          }
          .match-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          @page {
            margin: 15mm;
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

          <div className="mb-8">
            <div className="flex items-center justify-center gap-6 mb-3">
              <img src="/brand/anz.svg" alt="ANZ" className="h-12 w-auto" style={{ height: "48px", width: "auto" }} />
              <img src="/brand/SUP.svg" alt="Super Rugby" className="h-12 w-auto" style={{ height: "48px", width: "auto" }} />
            </div>
            <h1 className="text-2xl font-bold text-black text-center">
              ANZ Super Rugby Picks Competition
            </h1>
            <div className="text-lg text-black mt-1 text-center">
              Season {round.season} - Round {round.round_number}
            </div>
            <div className="text-base text-black mt-2 text-center">
              Team: {participant.team_name}
            </div>
            <div className="text-sm text-black mt-1 text-center">
              Generated: {formatDateGenerated()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
          {fixtures.map((fixture) => {
            const homeTeam = teams[fixture.home_team_code];
            const awayTeam = teams[fixture.away_team_code];
            const homeName = homeTeam?.name || fixture.home_team_code;
            const awayName = awayTeam?.name || fixture.away_team_code;
            const kickoffStr = formatKickoff(fixture.kickoff_at);
            const homeLogoPath = `/teams/${fixture.home_team_code}.svg`;
            const awayLogoPath = `/teams/${fixture.away_team_code}.svg`;
            const pick = picks[fixture.id];
            const isHomePicked = pick && pick.picked_team === fixture.home_team_code;
            const isAwayPicked = pick && pick.picked_team === fixture.away_team_code;
            const isDrawPicked = pick && pick.picked_team === "DRAW";
            const marginBand = pick && pick.margin >= 1 && pick.margin <= 12 ? "1-12" : pick && pick.margin >= 13 ? "13+" : null;

            return (
              <div key={fixture.id} className="border-2 border-black p-4 match-card">
                {kickoffStr && (
                  <div className="text-center mb-3 font-bold text-base text-black">
                    {kickoffStr}
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-col items-center flex-1">
                    <img
                      src={homeLogoPath}
                      alt={homeName}
                      className="h-12 w-12 mb-1 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `/teams/${fixture.home_team_code}.webp`;
                      }}
                    />
                    <input type="checkbox" className="w-4 h-4" checked={isHomePicked} readOnly />
                  </div>
                  <span className="mx-2 text-black font-bold">vs</span>
                  <div className="flex flex-col items-center flex-1">
                    <img
                      src={awayLogoPath}
                      alt={awayName}
                      className="h-12 w-12 mb-1 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `/teams/${fixture.away_team_code}.webp`;
                      }}
                    />
                    <input type="checkbox" className="w-4 h-4" checked={isAwayPicked} readOnly />
                  </div>
                </div>
                <div className="border-t border-black pt-2">
                  <div className="text-xs font-semibold text-black mb-1">Margin:</div>
                  <div className="flex justify-around">
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" checked={marginBand === "1-12"} readOnly />
                      1–12
                    </label>
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" checked={marginBand === "13+"} readOnly />
                      13+
                    </label>
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" checked={isDrawPicked} readOnly />
                      Draw
                    </label>
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
