"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { calculatePickScore } from "@/lib/scoring";

type Round = {
  id: string;
  season: number;
  round_number: number;
};

type Participant = {
  id: string;
  team_name: string;
};

type Fixture = {
  id: string;
  round_id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
};

type Team = {
  code: string;
  name: string;
};

type Pick = {
  id: string;
  participant_id: string;
  fixture_id: string;
  picked_team: string;
  margin: number;
  updated_at: string;
  created_at: string;
};

type Result = {
  fixture_id: string;
  winning_team: string;
  margin_band: string | null;
};

type PickDisplay = {
  matchLabel: string; // Compact format
  fullMatchLabel: string; // Full format for tooltip
  teamName: string; // Full participant team name
  pickLabel: string; // 3-letter code
  marginBand: string;
  updated: string;
  fixtureId: string;
  points: number | null; // null if no result yet
  participantId: string;
  pickedTeam: string;
  margin: number;
};

export default function AdminPicksPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [mode, setMode] = useState<"team" | "match">("team");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [picks, setPicks] = useState<Pick[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [displayPicks, setDisplayPicks] = useState<PickDisplay[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Admin gate: check authentication and admin email on load
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      // Check admin email allowlist (case-insensitive)
      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmails = envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const userIsAdmin = adminEmails.length > 0 && userEmailLower && adminEmails.includes(userEmailLower);
      
      if (!userIsAdmin) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      setIsAdmin(true);
      setAuthChecked(true);
      
      // Fetch initial data
      fetchRounds();
      fetchTeams();
    };

    checkAdmin();
  }, [router]);

  async function fetchRounds() {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .order("season", { ascending: true })
        .order("round_number", { ascending: true });

      if (error) {
        console.error("Error fetching rounds:", error);
      } else {
        const roundsData = data || [];
        setRounds(roundsData);
        // Default selection will be handled by useEffect after rounds are loaded
      }
    } catch (err) {
      console.error("Unexpected error fetching rounds:", err);
    }
  }


  // Set default round selection: first round with fixtures, or Round 1
  useEffect(() => {
    if (rounds.length === 0 || selectedRoundId !== null) {
      return; // Don't set default if rounds aren't loaded or a round is already selected
    }

    async function findDefaultRound() {
      try {
        // Get round IDs in ascending order
        const roundIds = rounds.map((r) => r.id);

        // Query fixtures for all rounds to find which ones have fixtures
        const { data: fixturesData, error: fixturesError } = await supabase
          .from("fixtures")
          .select("round_id")
          .in("round_id", roundIds);

        if (fixturesError) {
          console.error("Error checking fixtures for default round:", fixturesError);
          // Fall back to Round 1
          const round1 = rounds.find((r) => r.round_number === 1);
          if (round1) {
            setSelectedRoundId(round1.id);
          }
          return;
        }

        // Find rounds that have fixtures
        const roundsWithFixtures = new Set(
          (fixturesData || []).map((f) => f.round_id)
        );

        // Find the first round (in ascending order) that has fixtures
        const firstRoundWithFixtures = rounds.find((r) =>
          roundsWithFixtures.has(r.id)
        );

        if (firstRoundWithFixtures) {
          setSelectedRoundId(firstRoundWithFixtures.id);
        } else {
          // No rounds have fixtures, fall back to Round 1
          const round1 = rounds.find((r) => r.round_number === 1);
          if (round1) {
            setSelectedRoundId(round1.id);
          } else if (rounds.length > 0) {
            // Last resort: use the first round in the list
            setSelectedRoundId(rounds[0].id);
          }
        }
      } catch (err) {
        console.error("Unexpected error finding default round:", err);
        // Fall back to Round 1
        const round1 = rounds.find((r) => r.round_number === 1);
        if (round1) {
          setSelectedRoundId(round1.id);
        }
      }
    }

    findDefaultRound();
  }, [rounds, selectedRoundId]);

  async function fetchTeams() {
    try {
      const { data, error } = await supabase
        .from("super_rugby_teams")
        .select("code, name");

      if (error) {
        console.error("Error fetching teams:", error);
      } else {
        const teamsMap: Record<string, Team> = {};
        (data || []).forEach((team) => {
          teamsMap[team.code] = team;
        });
        setTeams(teamsMap);
      }
    } catch (err) {
      console.error("Unexpected error fetching teams:", err);
    }
  }

  // Fetch fixtures, participants, and picks when round is selected
  useEffect(() => {
    if (!selectedRoundId) {
      setFixtures([]);
      setParticipants([]);
      setPicks([]);
      setResults({});
      setDisplayPicks([]);
      setError(null);
      return;
    }

    async function fetchPicksData() {
      setLoading(true);
      setError(null);
      try {
        // Get session token for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/admin/picks-view?roundId=${selectedRoundId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to fetch picks data" }));
          setError(errorData.error || `Error ${response.status}: ${response.statusText}`);
          setFixtures([]);
          setParticipants([]);
          setPicks([]);
          setResults({});
          setDisplayPicks([]);
          setLoading(false);
          return;
        }

        const data = await response.json();

        // Update teams map from superRugbyTeams
        if (data.superRugbyTeams) {
          const teamsMap: Record<string, Team> = {};
          data.superRugbyTeams.forEach((team: Team) => {
            teamsMap[team.code] = team;
          });
          setTeams(teamsMap);
        }

        setFixtures(data.fixtures || []);
        setParticipants(data.participants || []);
        setPicks(data.picks || []);
        
        // Build results map
        const resultsMap: Record<string, Result> = {};
        (data.results || []).forEach((r: Result) => {
          resultsMap[r.fixture_id] = r;
        });
        setResults(resultsMap);
        
        // Display picks will be rebuilt by useEffect when state updates
      } catch (err) {
        console.error("Unexpected error fetching picks data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch picks data");
        setFixtures([]);
        setParticipants([]);
        setPicks([]);
        setResults({});
        setDisplayPicks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchPicksData();
  }, [selectedRoundId]);

  function buildDisplayPicks(picksData: Pick[], fixtureIds: string[]) {
    // Build maps
    const participantMap: Record<string, string> = {};
    participants.forEach((p) => {
      participantMap[p.id] = p.team_name;
    });

    const fixtureMap: Record<string, Fixture> = {};
    fixtures.forEach((f) => {
      fixtureMap[f.id] = f;
    });

    // Also build a map for fixture match numbers for sorting
    const fixtureMatchMap: Record<string, number> = {};
    fixtures.forEach((f) => {
      fixtureMatchMap[f.id] = f.match_number;
    });

    // Build display picks
    const display: PickDisplay[] = [];

    picksData.forEach((pick) => {
      const fixture = fixtureMap[pick.fixture_id];
      if (!fixture) return;

      // Use 3-letter codes for teams
      const homeCode = fixture.home_team_code;
      const awayCode = fixture.away_team_code;

      // Format kickoff time (compact)
      let kickoffStr = "";
      if (fixture.kickoff_at) {
        const kickoffDate = new Date(fixture.kickoff_at);
        kickoffStr = kickoffDate.toLocaleString("en-NZ", {
          timeZone: "Pacific/Auckland",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }

      // Compact match label: M{match_number}: {HOME} vs {AWAY} ({kickoff})
      const compactMatchLabel = `M${fixture.match_number}: ${homeCode} vs ${awayCode}${kickoffStr ? ` (${kickoffStr})` : ""}`;
      
      // Full match label for tooltip
      const homeTeam = teams[fixture.home_team_code];
      const awayTeam = teams[fixture.away_team_code];
      const homeName = homeTeam?.name || fixture.home_team_code;
      const awayName = awayTeam?.name || fixture.away_team_code;
      const fullMatchLabel = `Match ${fixture.match_number}: ${homeName} vs ${awayName}${kickoffStr ? ` (${kickoffStr})` : ""}`;
      
      // Use full participant team name (no abbreviation)
      const teamName = participantMap[pick.participant_id] || "Unknown";

      // Format pick label - use 3-letter code
      let pickLabel = "";
      if (pick.picked_team === "DRAW") {
        pickLabel = "DRAW";
      } else {
        pickLabel = pick.picked_team; // Already a 3-letter code
      }

      // Format margin/band
      let marginBand = "—";
      if (pick.picked_team !== "DRAW") {
        if (pick.margin === 1) {
          marginBand = "1-12";
        } else if (pick.margin === 13) {
          marginBand = "13+";
        }
      }

      // Format updated time
      const updatedDate = pick.updated_at ? new Date(pick.updated_at) : new Date(pick.created_at);
      const updated = updatedDate.toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });

      // Calculate points if result exists
      let points: number | null = null;
      const result = results[pick.fixture_id];
      if (result) {
        const score = calculatePickScore(pick.picked_team, pick.margin, {
          winning_team: result.winning_team,
          margin_band: result.margin_band,
        });
        points = score.totalPoints;
      }

      display.push({
        matchLabel: compactMatchLabel,
        fullMatchLabel,
        teamName,
        pickLabel,
        marginBand,
        updated,
        fixtureId: pick.fixture_id,
        points,
        participantId: pick.participant_id,
        pickedTeam: pick.picked_team,
        margin: pick.margin,
      });
    });

    // Sort by fixture match number, then by kickoff time, then by team name
    display.sort((a, b) => {
      const fixtureA = fixtureMap[a.fixtureId];
      const fixtureB = fixtureMap[b.fixtureId];
      if (!fixtureA || !fixtureB) return 0;
      
      // First sort by match number
      if (fixtureA.match_number !== fixtureB.match_number) {
        return fixtureA.match_number - fixtureB.match_number;
      }
      
      // Then by kickoff time
      const timeA = fixtureA.kickoff_at ? new Date(fixtureA.kickoff_at).getTime() : 0;
      const timeB = fixtureB.kickoff_at ? new Date(fixtureB.kickoff_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      // Finally by team name (A-Z) for when showing all teams
      return a.teamName.localeCompare(b.teamName);
    });

    setDisplayPicks(display);
  }

  // Rebuild display picks when picks, fixtures, participants, teams, or results change
  useEffect(() => {
    if (picks.length > 0 && fixtures.length > 0) {
      buildDisplayPicks(picks, fixtures.map((f) => f.id));
    } else if (picks.length === 0) {
      setDisplayPicks([]);
    }
  }, [picks, fixtures, participants, teams, results]);

  // Keyboard navigation for rounds (left/right arrows)
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is in an input or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = selectedRoundId
          ? rounds.findIndex((r) => r.id === selectedRoundId)
          : -1;
        if (currentIndex > 0) {
          setSelectedRoundId(rounds[currentIndex - 1].id);
        } else if (rounds.length > 0 && currentIndex === -1) {
          // If no round selected, go to first round
          setSelectedRoundId(rounds[0].id);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = selectedRoundId
          ? rounds.findIndex((r) => r.id === selectedRoundId)
          : -1;
        if (currentIndex >= 0 && currentIndex < rounds.length - 1) {
          setSelectedRoundId(rounds[currentIndex + 1].id);
        } else if (rounds.length > 0 && currentIndex === -1) {
          // If no round selected, go to first round
          setSelectedRoundId(rounds[0].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAdmin, selectedRoundId, rounds]);

  // Filter display picks based on mode and selection
  const filteredPicks = displayPicks.filter((pick) => {
    if (mode === "team") {
      if (!selectedTeamId) return true;
      const selectedTeam = participants.find((p) => p.id === selectedTeamId);
      return selectedTeam && pick.teamName === selectedTeam.team_name;
    } else {
      // mode === "match"
      if (!selectedFixtureId) return true;
      return pick.fixtureId === selectedFixtureId;
    }
  });

  // Show "Checking access..." while auth check is in progress
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-700 dark:text-zinc-300">Checking access...</p>
        </div>
      </div>
    );
  }

  // If auth check completed but user is not admin, render nothing (redirect already happened)
  if (authChecked && !isAdmin) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Admin - Picks
        </h1>
      </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Round
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRoundId || ""}
                  onChange={(e) => setSelectedRoundId(e.target.value || null)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">Select round</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Season {round.season} - Round {round.round_number}
                    </option>
                  ))}
                </select>
                {(() => {
                  const currentIndex = selectedRoundId
                    ? rounds.findIndex((r) => r.id === selectedRoundId)
                    : -1;
                  const canGoPrev = currentIndex > 0;
                  const canGoNext = currentIndex >= 0 && currentIndex < rounds.length - 1;
                  
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (canGoPrev) {
                            setSelectedRoundId(rounds[currentIndex - 1].id);
                          }
                        }}
                        disabled={!canGoPrev}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          canGoPrev
                            ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                        }`}
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (canGoNext) {
                            setSelectedRoundId(rounds[currentIndex + 1].id);
                          }
                        }}
                        disabled={!canGoNext}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          canGoNext
                            ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                        }`}
                      >
                        Next
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("team");
                    setSelectedFixtureId(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "team"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}
                >
                  By Team
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("match");
                    setSelectedTeamId(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "match"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                  }`}
                >
                  By Match
                </button>
              </div>
            </div>

            {mode === "team" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Team
                </label>
                <select
                  value={selectedTeamId || ""}
                  onChange={(e) => setSelectedTeamId(e.target.value || null)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">All teams</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.team_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === "match" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Match
                </label>
                <select
                  value={selectedFixtureId || ""}
                  onChange={(e) => setSelectedFixtureId(e.target.value || null)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  <option value="">All matches</option>
                  {fixtures.map((fixture) => {
                    const homeTeam = teams[fixture.home_team_code];
                    const awayTeam = teams[fixture.away_team_code];
                    const homeName = homeTeam?.name || fixture.home_team_code;
                    const awayName = awayTeam?.name || fixture.away_team_code;
                    return (
                      <option key={fixture.id} value={fixture.id}>
                        Match {fixture.match_number}: {homeName} vs {awayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Round Total Summary (By Team mode only) */}
        {mode === "team" && selectedRoundId && filteredPicks.length > 0 && (
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Round total: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {filteredPicks.reduce((sum, pick) => sum + (pick.points ?? 0), 0)} pts
                </span>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Scored games: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {Object.keys(results).length} / {fixtures.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {!selectedRoundId ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">Select a round</p>
          </div>
        ) : loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">Loading picks...</p>
          </div>
        ) : filteredPicks.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">No picks found for this selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  {mode === "team" && !selectedTeamId ? (
                    <>
                      <th className="px-4 py-1.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Team
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Match
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Pick
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Margin/Band
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Points
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Updated
                      </th>
                    </>
                  ) : mode === "team" ? (
                    <>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Match
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Pick
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Margin/Band
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Points
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Updated
                      </th>
                    </>
                    ) : (
                      <>
                        <th className="px-4 py-1.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          Team
                        </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Pick
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Margin/Band
                      </th>
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Updated
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {filteredPicks.map((pick, index) => (
                  <tr key={index} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    {mode === "team" && !selectedTeamId ? (
                      <>
                        <td className="px-4 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 truncate max-w-[220px]" title={pick.teamName}>
                          {pick.teamName}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 truncate max-w-[280px]" title={pick.fullMatchLabel}>
                          {pick.matchLabel}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap font-mono">
                          {pick.pickLabel}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.marginBand}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.points !== null ? pick.points : "—"}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.updated}
                        </td>
                      </>
                    ) : mode === "team" ? (
                      <>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 truncate max-w-[280px]" title={pick.fullMatchLabel}>
                          {pick.matchLabel}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap font-mono">
                          {pick.pickLabel}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.marginBand}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.points !== null ? pick.points : "—"}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.updated}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-1.5 text-sm text-zinc-900 dark:text-zinc-50 truncate max-w-[220px]" title={pick.teamName}>
                          {pick.teamName}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap font-mono">
                          {pick.pickLabel}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.marginBand}
                        </td>
                        <td className="px-4 py-1.5 text-xs text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                          {pick.updated}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
