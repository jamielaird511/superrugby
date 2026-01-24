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

export default function PrintRoundPage() {
  const params = useParams();
  const roundId = params.roundId as string;
  const [round, setRound] = useState<Round | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [roundId]);

  useEffect(() => {
    if (round) {
      document.title = `ANZ Super Rugby Picks - Season ${round.season} Round ${round.round_number}`;
    }
  }, [round]);

  const fetchData = async () => {
    try {
      setErrorMsg(null);

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

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("super_rugby_teams")
        .select("code, name, logo_path");

      if (teamsError) throw teamsError;
      const teamsMap: Record<string, Team> = {};
      (teamsData || []).forEach((team) => {
        teamsMap[team.code] = team;
      });
      setTeams(teamsMap);
    } catch (err) {
      const anyErr = err as any;
      const msg =
        anyErr?.message ||
        anyErr?.error_description ||
        anyErr?.details ||
        (typeof anyErr === "string" ? anyErr : null) ||
        JSON.stringify(anyErr);
      console.error("Error fetching data:", anyErr);
      console.error("Error details:", { message: anyErr?.message, code: anyErr?.code, details: anyErr?.details, hint: anyErr?.hint });
      setErrorMsg(msg ?? "Unknown error");
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

  if (!round) {
    return (
      <div className="p-8">
        <p>Round not found</p>
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
          .print-hidden {
            display: none !important;
          }
          body {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .print-container {
            max-width: 100%;
            padding: 0;
            background: white !important;
          }
          .print-content {
            max-width: 180mm;
            margin: 0 auto;
            padding: 15mm 10mm;
            background: white !important;
            color: black !important;
          }
          .match-card {
            page-break-inside: avoid;
            break-inside: avoid;
            background: white !important;
            color: black !important;
          }
          .match-card * {
            color: black !important;
          }
          h1, h2, h3, p, span, div, label, input {
            color: black !important;
          }
          body, .print-container, .print-content, .match-card {
            background: white !important;
          }
          div:not(.match-card) {
            background: transparent !important;
          }
          @page {
            margin: 15mm;
            size: A4;
            background: white;
          }
        }
        @media screen {
          .print-container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: white;
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

          {errorMsg && (
            <div className="print-hidden mb-4 rounded-lg border-2 border-red-500 bg-red-50 p-4">
              <p className="font-semibold text-red-800">Couldn't load print data: {errorMsg}</p>
            </div>
          )}

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
          </div>

          <div className="grid grid-cols-2 gap-4">
          {fixtures.map((fixture) => {
            const homeTeam = teams[fixture.home_team_code];
            const awayTeam = teams[fixture.away_team_code];
            const homeName = homeTeam?.name || fixture.home_team_code;
            const awayName = awayTeam?.name || fixture.away_team_code;
            const kickoffStr = formatKickoff(fixture.kickoff_at);
            const homeLogoPath = getTeamLogoUrl(homeTeam?.logo_path || null, fixture.home_team_code);
            const awayLogoPath = getTeamLogoUrl(awayTeam?.logo_path || null, fixture.away_team_code);

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
                    <input type="checkbox" className="w-4 h-4" />
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
                    <input type="checkbox" className="w-4 h-4" />
                  </div>
                </div>
                <div className="border-t border-black pt-2">
                  <div className="text-xs font-semibold text-black mb-1">Margin:</div>
                  <div className="flex justify-around">
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" />
                      1–12
                    </label>
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" />
                      13+
                    </label>
                    <label className="flex items-center gap-1 text-xs text-black">
                      <input type="checkbox" className="w-4 h-4" />
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
