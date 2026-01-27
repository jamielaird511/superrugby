"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeamNav from "@/components/TeamNav";
import * as Select from "@radix-ui/react-select";
import { calculatePickScore } from "@/lib/scoring";
import PrintButton from "@/components/PrintButton";

type Participant = {
  id: string;
  team_name: string;
  category: string | null;
};

type Round = {
  id: string;
  season: number;
  round_number: number;
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
  participant_id: string;
  picked_team: string;
  margin: number;
};

type Result = {
  fixture_id: string;
  winning_team: string;
  margin_band: string | null;
};

type Team = {
  code: string;
  name: string;
};

type RoundScore = {
  participant_id: string;
  team_name: string;
  category: string | null;
  total_points: number;
};

type OverallScore = {
  participant_id: string;
  team_name: string;
  category: string | null;
  total_points: number;
  business_name?: string;
};

// Helper functions for leaderboard windows
function sortLeaderboardRows<T extends { total_points: number; team_name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    // Primary sort: points descending
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    // Tiebreaker: team_name ascending (stable)
    return a.team_name.localeCompare(b.team_name);
  });
}

function getWindowAroundTeam<T extends { participant_id: string }>(
  sortedRows: T[],
  myTeamId: string,
  windowSize: number = 5
): { windowRows: T[]; startRank: number } {
  // Find my team's index
  const myIndex = sortedRows.findIndex((row) => row.participant_id === myTeamId);

  if (myIndex === -1) {
    // Team not found, return top 5
    return {
      windowRows: sortedRows.slice(0, windowSize),
      startRank: 1,
    };
  }

  // Calculate window bounds (centered on my team, clamped at ends)
  const halfWindow = Math.floor(windowSize / 2);
  let startIndex = Math.max(0, myIndex - halfWindow);
  const endIndex = Math.min(sortedRows.length, startIndex + windowSize);

  // Adjust if we hit the end
  if (endIndex - startIndex < windowSize) {
    startIndex = Math.max(0, endIndex - windowSize);
  }

  return {
    windowRows: sortedRows.slice(startIndex, endIndex),
    startRank: startIndex + 1,
  };
}

function formatCategoryLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Scoring functions
function calculateFixturePoints(
  pick: Pick | null,
  result: Result | null
): { winnerPoints: number; marginPoints: number; totalPoints: number } {
  if (!pick || !result) {
    return { winnerPoints: 0, marginPoints: 0, totalPoints: 0 };
  }

  return calculatePickScore(pick.picked_team, pick.margin, {
    winning_team: result.winning_team,
    margin_band: result.margin_band,
  });
}

function calculateRoundScores(
  fixtures: Fixture[],
  picks: Pick[],
  results: Record<string, Result>
): RoundScore[] {
  const scoresByParticipant: Record<string, RoundScore> = {};

  fixtures.forEach((fixture) => {
    const result = results[fixture.id];
    if (!result) return; // Skip fixtures without final results

    const fixturePicks = picks.filter((p) => p.fixture_id === fixture.id);
    fixturePicks.forEach((pick) => {
      if (!scoresByParticipant[pick.participant_id]) {
        scoresByParticipant[pick.participant_id] = {
          participant_id: pick.participant_id,
          team_name: "",
          category: null,
          total_points: 0,
        };
      }

      const { totalPoints } = calculateFixturePoints(pick, result);
      scoresByParticipant[pick.participant_id].total_points += totalPoints;
    });
  });

  return Object.values(scoresByParticipant);
}

function calculateOverallScores(
  allFixtures: Fixture[],
  allPicks: Pick[],
  allResults: Record<string, Result>
): OverallScore[] {
  const scoresByParticipant: Record<string, OverallScore> = {};

  allFixtures.forEach((fixture) => {
    const result = allResults[fixture.id];
    if (!result) return; // Skip fixtures without final results

    const fixturePicks = allPicks.filter((p) => p.fixture_id === fixture.id);
    fixturePicks.forEach((pick) => {
      if (!scoresByParticipant[pick.participant_id]) {
        scoresByParticipant[pick.participant_id] = {
          participant_id: pick.participant_id,
          team_name: "",
          category: null,
          total_points: 0,
        };
      }

      const { totalPoints } = calculateFixturePoints(pick, result);
      scoresByParticipant[pick.participant_id].total_points += totalPoints;
    });
  });

  return Object.values(scoresByParticipant);
}

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const participantId = params.id as string;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  // Data state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [roundFixtures, setRoundFixtures] = useState<Fixture[]>([]);
  const [allFixtures, setAllFixtures] = useState<Fixture[]>([]);
  const [roundResults, setRoundResults] = useState<Record<string, Result>>({});
  const [allResults, setAllResults] = useState<Record<string, Result>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});

  // Computed scores
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [overallScores, setOverallScores] = useState<OverallScore[]>([]);

  // Snapshot round state (independent from main round selector)
  const [snapshotRoundId, setSnapshotRoundId] = useState<string | null>(null);
  const [snapshotRoundFixtures, setSnapshotRoundFixtures] = useState<Fixture[]>([]);
  const [snapshotRoundResults, setSnapshotRoundResults] = useState<Record<string, Result>>({});
  const [snapshotRoundScores, setSnapshotRoundScores] = useState<RoundScore[]>([]);

  // Section view state
  const [activeView, setActiveView] = useState<"overall" | "rounds" | "categories">("overall");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [businessNamesByParticipant, setBusinessNamesByParticipant] = useState<Record<string, string>>({});

  // Fun stats state
  const [funStats, setFunStats] = useState<{
    mode: string;
    fixtures_scored: number;
    gutFeelWins: number;
    secondGuessWins: number;
    unchanged: number;
    pointsGained: number;
    pointsLost: number;
    totalChanges: number;
    mostIndecisive: {
      fixture_id: string;
      changes: number;
      first_pick: { picked_team: string; margin: number };
      final_pick: { picked_team: string; margin: number };
      first_points: number;
      final_points: number;
      delta: number;
    } | null;
  } | null>(null);
  const [gutScope, setGutScope] = useState<"season" | "round">("season");
  const [selectedGutRoundId, setSelectedGutRoundId] = useState<string | null>(null);
  const gutDefaultHasBeenSet = useRef(false);
  const [participantLeagueId, setParticipantLeagueId] = useState<string | null>(null);
  const [participantCompetitionId, setParticipantCompetitionId] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("participant_id");
    window.location.href = "/";
  };

  useEffect(() => {
    if (participantId) {
      gutDefaultHasBeenSet.current = false;
      fetchInitialData();
    }
  }, [participantId]);

  useEffect(() => {
    if (selectedRoundId) {
      fetchRoundData(selectedRoundId);
    }
  }, [selectedRoundId]);

  useEffect(() => {
    if (snapshotRoundId) {
      fetchSnapshotRoundData(snapshotRoundId);
    }
  }, [snapshotRoundId]);

  // Default gut scope to last completed round (highest round_number with >=1 result) after data loads
  useEffect(() => {
    if (gutDefaultHasBeenSet.current || rounds.length === 0) return;
    const roundsWithResultIds = new Set<string>();
    allFixtures.forEach((f) => {
      if (allResults[f.id]) roundsWithResultIds.add(f.round_id);
    });
    const completed = rounds.filter((r) => roundsWithResultIds.has(r.id));
    const lastCompleted = completed.length > 0
      ? [...completed].sort((a, b) => b.round_number - a.round_number)[0]
      : null;
    if (lastCompleted) {
      setGutScope("round");
      setSelectedGutRoundId(lastCompleted.id);
    } else {
      setGutScope("season");
      setSelectedGutRoundId(rounds[0]?.id ?? null);
    }
    gutDefaultHasBeenSet.current = true;
  }, [rounds, allFixtures, allResults]);

  useEffect(() => {
    if (!participantId) return;
    if (gutScope === "round" && !selectedGutRoundId) return;
    fetchFunStats();
  }, [participantId, gutScope, selectedGutRoundId]);

  const fetchFunStats = async () => {
    try {
      let url = `/api/fun-stats?participantId=${participantId}&mode=${gutScope}`;
      if (gutScope === "round" && selectedGutRoundId) {
        url += `&roundId=${selectedGutRoundId}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setFunStats(data);
      } else {
        console.warn("Error fetching fun stats:", response.statusText);
      }
    } catch (err) {
      console.error("Error fetching fun stats:", err);
    }
  };




  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch current participant
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id, business_name, team_name, category, league_id")
        .eq("id", participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant({
        id: participantData.id,
        team_name: participantData.team_name,
        category: participantData.category,
      });
      setParticipantLeagueId(participantData.league_id);

      // Look up competition_id for this participant's league
      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("competition_id")
        .eq("id", participantData.league_id)
        .maybeSingle();

      if (leagueError || !league) {
        console.error("Error fetching league/competition for results:", leagueError);
        setLoading(false);
        return;
      }

      const competitionId = league.competition_id as string | null;
      setParticipantCompetitionId(competitionId);

      // Fetch all participants
      const { data: allParticipantsData, error: allParticipantsError } = await supabase
        .from("participants")
        .select("id, team_name, category")
        .order("team_name", { ascending: true });

      if (allParticipantsError) throw allParticipantsError;
      setParticipants(
        (allParticipantsData || []).map((p) => ({
          id: p.id,
          team_name: p.team_name,
          category: p.category,
        }))
      );

      // Fetch all categories from participants_public
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("participants_public")
        .select("category")
        .not("category", "is", null);

      if (!categoriesError) {
        const options = Array.from(
          new Set((categoriesData || []).map((r) => r.category).filter(Boolean))
        ).sort();
        setCategoryOptions(options);
      }

      // Fetch business names from participants_public
      const { data: businessData, error: businessError } = await supabase
        .from("participants_public")
        .select("id, business_name");

      if (businessError) {
        console.warn("Error fetching business names:", businessError);
      } else if (businessData) {
        const map: Record<string, string> = {};
        businessData.forEach((r) => {
          if (r.id) map[r.id] = r.business_name ?? "";
        });
        setBusinessNamesByParticipant(map);
      }

      // Fetch rounds for current season and participant's competition
      const currentSeason = new Date().getFullYear();
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .eq("season", currentSeason)
        .eq("competition_id", competitionId)
        .order("round_number", { ascending: true });

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

      // Set default selected round to first round
      if (roundsData && roundsData.length > 0) {
        setSelectedRoundId(roundsData[0].id);
        setSnapshotRoundId(roundsData[0].id);
      }

      // Fetch all fixtures for current season and participant's competition
      const { data: allFixturesData, error: allFixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .in(
          "round_id",
          (roundsData || []).map((r) => r.id)
        )
        .eq("competition_id", competitionId)
        .order("kickoff_at", { ascending: true });

      if (allFixturesError) throw allFixturesError;
      setAllFixtures(allFixturesData || []);

      // Fetch overall leaderboard (filtered by participant's league)
      const { data: overallLeaderboardData, error: overallLeaderboardError } = await supabase
        .from("leaderboard_overall_public")
        .select("participant_id, team_name, category, total_points")
        .eq("league_id", participantData.league_id);

      if (overallLeaderboardError) {
        console.warn("Error fetching overall leaderboard:", overallLeaderboardError);
        setOverallScores([]);
      } else {
        const sorted = sortLeaderboardRows(overallLeaderboardData || []);
        setOverallScores(sorted);
      }

      // Fetch all results
      const fixtureIds = (allFixturesData || []).map((f) => f.id);
      if (fixtureIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("results")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds);

        if (resultsError) {
          console.warn("Error fetching results:", resultsError);
        } else {
          const resultsMap: Record<string, Result> = {};
          (resultsData || []).forEach((result) => {
            resultsMap[result.fixture_id] = result;
          });
          setAllResults(resultsMap);
        }
      }

      // Fetch teams
      const { data: teamsData, error: teamsError } = await supabase
        .from("super_rugby_teams")
        .select("code, name");

      if (teamsError) {
        console.warn("Error fetching teams:", teamsError);
      } else {
        const teamsMap: Record<string, Team> = {};
        (teamsData || []).forEach((team) => {
          teamsMap[team.code] = { code: team.code, name: team.name };
        });
        setTeams(teamsMap);
      }
    } catch (err) {
      console.error("Error fetching initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoundData = async (roundId: string) => {
    if (!participantLeagueId || !participantCompetitionId) return;
    try {
      // Fetch fixtures for selected round and participant's competition
      const { data: fixturesData, error: fixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .eq("competition_id", participantCompetitionId)
        .order("match_number", { ascending: true });

      if (fixturesError) throw fixturesError;
      setRoundFixtures(fixturesData || []);

      // Fetch round leaderboard (filtered by participant's league)
      const { data: roundLeaderboardData, error: roundLeaderboardError } = await supabase
        .from("leaderboard_round_public")
        .select("participant_id, team_name, category, total_points")
        .eq("round_id", roundId)
        .eq("league_id", participantLeagueId);

      if (roundLeaderboardError) {
        console.warn("Error fetching round leaderboard:", roundLeaderboardError);
        setRoundScores([]);
      } else {
        const sorted = sortLeaderboardRows(roundLeaderboardData || []);
        setRoundScores(sorted);
      }

      // Fetch results for this round (still needed for hasFinalResults check)
      const fixtureIds = (fixturesData || []).map((f) => f.id);
      if (fixtureIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("results")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds);

        if (resultsError) {
          console.warn("Error fetching round results:", resultsError);
          setRoundResults({});
        } else {
          const resultsMap: Record<string, Result> = {};
          (resultsData || []).forEach((result) => {
            resultsMap[result.fixture_id] = result;
          });
          setRoundResults(resultsMap);
        }
      } else {
        setRoundResults({});
      }
    } catch (err) {
      console.error("Error fetching round data:", err);
    }
  };

  const fetchSnapshotRoundData = async (roundId: string) => {
    if (!participantLeagueId || !participantCompetitionId) return;
    try {
      // Fetch fixtures for snapshot round and participant's competition
      const { data: fixturesData, error: fixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .eq("competition_id", participantCompetitionId)
        .order("match_number", { ascending: true });

      if (fixturesError) throw fixturesError;
      setSnapshotRoundFixtures(fixturesData || []);

      // Fetch snapshot round leaderboard (filtered by participant's league)
      const { data: snapshotRoundLeaderboardData, error: snapshotRoundLeaderboardError } = await supabase
        .from("leaderboard_round_public")
        .select("participant_id, team_name, category, total_points")
        .eq("round_id", roundId)
        .eq("league_id", participantLeagueId);

      if (snapshotRoundLeaderboardError) {
        console.warn("Error fetching snapshot round leaderboard:", snapshotRoundLeaderboardError);
        setSnapshotRoundScores([]);
      } else {
        const sorted = sortLeaderboardRows(snapshotRoundLeaderboardData || []);
        setSnapshotRoundScores(sorted);
      }

      // Fetch results for this round (still needed for hasFinalResults check)
      const fixtureIds = (fixturesData || []).map((f) => f.id);
      if (fixtureIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("results")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds);

        if (resultsError) {
          console.warn("Error fetching snapshot round results:", resultsError);
          setSnapshotRoundResults({});
        } else {
          const resultsMap: Record<string, Result> = {};
          (resultsData || []).forEach((result) => {
            resultsMap[result.fixture_id] = result;
          });
          setSnapshotRoundResults(resultsMap);
        }
      } else {
        setSnapshotRoundResults({});
      }
    } catch (err) {
      console.error("Error fetching snapshot round data:", err);
    }
  };

  const hasFinalResults = (results: Record<string, Result>): boolean => {
    return Object.keys(results).length > 0;
  };

  const getCategoryScores = (category: string | null): OverallScore[] => {
    return overallScores.filter((score) => score.category === category);
  };

  const categories = Array.from(new Set(participants.map((p) => p.category).filter((c): c is string => c !== null))).sort();

  // Set default category when Categories view becomes active
  useEffect(() => {
    if (activeView === "categories" && categoryOptions.length > 0) {
      // If no category selected or selected category is no longer valid, set default
      if (!selectedCategory || !categoryOptions.includes(selectedCategory)) {
        // Default to participant's category if available, otherwise first category
        const participantCategory = participant?.category;
        if (participantCategory && categoryOptions.includes(participantCategory)) {
          setSelectedCategory(participantCategory);
        } else {
          setSelectedCategory(categoryOptions[0]);
        }
      }
    } else if (activeView === "categories" && categoryOptions.length === 0) {
      setSelectedCategory("");
    }
  }, [activeView, categoryOptions, participant, selectedCategory]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans pt-16">
        <div className="text-center">
          <p className="text-zinc-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans pt-16">
      <TeamNav teamId={participantId} teamName={participant?.team_name || "Team"} onLogout={handleLogout} />

      <div className="py-8 pt-8">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-3xl font-semibold text-[#003A5D] mb-6">Results</h1>

          {/* Summary Section */}
          <section className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Overall Snapshot */}
              <div className="lg:col-span-1 rounded-md border border-zinc-300 bg-white p-4">
                <h3 className="text-lg font-semibold text-[#003A5D] mb-1">Overall Snapshot</h3>
                <p className="text-xs text-zinc-600 mb-3">5-team context around you</p>
                {overallScores.length > 0 ? (
                  (() => {
                    const sorted = sortLeaderboardRows(overallScores);
                    const { windowRows, startRank } = getWindowAroundTeam(sorted, participantId, 5);
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Rank</th>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Team</th>
                              <th className="text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {windowRows.map((score, idx) => {
                              const isMyTeam = score.participant_id === participantId;
                              return (
                                <tr
                                  key={score.participant_id}
                                  className={isMyTeam ? "bg-blue-50 font-semibold" : ""}
                                >
                                  <td className="py-1.5 text-sm text-zinc-900">{startRank + idx}</td>
                                  <td className="py-1.5 text-sm text-zinc-900 max-w-[220px]">
                                    <span className="block truncate">{score.team_name}</span>
                                  </td>
                                  <td className="py-1.5 text-sm text-zinc-900 text-right">{score.total_points}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-zinc-600 italic">No final results yet.</p>
                )}
              </div>

              {/* Category Snapshot */}
              <div className="lg:col-span-1 rounded-md border border-zinc-300 bg-white p-4">
                <h3 className="text-lg font-semibold text-[#003A5D] mb-1">Category Snapshot</h3>
                <p className="text-xs text-zinc-600 mb-3">5-team context around you</p>
                {overallScores.length > 0 && participant?.category ? (
                  (() => {
                    const categoryScores = getCategoryScores(participant.category);
                    const sorted = sortLeaderboardRows(categoryScores);
                    const { windowRows, startRank } = getWindowAroundTeam(sorted, participantId, 5);
                    if (windowRows.length === 0) {
                      return <p className="text-xs text-zinc-600 italic">No teams in your category yet.</p>;
                    }
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Rank</th>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Team</th>
                              <th className="text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {windowRows.map((score, idx) => {
                              const isMyTeam = score.participant_id === participantId;
                              return (
                                <tr
                                  key={score.participant_id}
                                  className={isMyTeam ? "bg-blue-50 font-semibold" : ""}
                                >
                                  <td className="py-1.5 text-sm text-zinc-900">{startRank + idx}</td>
                                  <td className="py-1.5 text-sm text-zinc-900 max-w-[220px]">
                                    <span className="block truncate">{score.team_name}</span>
                                  </td>
                                  <td className="py-1.5 text-sm text-zinc-900 text-right">{score.total_points}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                ) : participant?.category ? (
                  <p className="text-xs text-zinc-600 italic">No final results yet.</p>
                ) : (
                  <p className="text-xs text-zinc-600 italic">No category assigned.</p>
                )}
              </div>

              {/* Round Snapshot */}
              <div className="lg:col-span-1 rounded-md border border-zinc-300 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold text-[#003A5D]">Round Snapshot</h3>
                </div>
                <div className="mb-3">
                  <Select.Root value={snapshotRoundId || undefined} onValueChange={setSnapshotRoundId}>
                    <Select.Trigger className="inline-flex items-center justify-between rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-[#003A5D] hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1 w-full max-w-[140px]">
                      <Select.Value placeholder="Select round" />
                      <Select.Icon className="ml-1">
                        <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 6H11L7.5 10.5L4 6Z" fill="currentColor" />
                        </svg>
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        side="bottom"
                        align="end"
                        sideOffset={6}
                        avoidCollisions={false}
                        className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                      >
                        <Select.Viewport
                          className="p-1 max-h-[240px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                          style={{ scrollbarWidth: "thin" }}
                        >
                          {rounds.map((round) => (
                            <Select.Item
                              key={round.id}
                              value={round.id}
                              className="relative flex items-center rounded-sm py-1.5 px-6 text-xs text-[#003A5D] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none cursor-pointer"
                            >
                              <Select.ItemText>Round {round.round_number}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
                <p className="text-xs text-zinc-600 mb-3">5-team context around you</p>
                {snapshotRoundScores.length > 0 ? (
                  (() => {
                    const sorted = sortLeaderboardRows(snapshotRoundScores);
                    const { windowRows, startRank } = getWindowAroundTeam(sorted, participantId, 5);
                    return (
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Rank</th>
                              <th className="text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Team</th>
                              <th className="text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider pb-2">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200">
                            {windowRows.map((score, idx) => {
                              const isMyTeam = score.participant_id === participantId;
                              return (
                                <tr
                                  key={score.participant_id}
                                  className={isMyTeam ? "bg-blue-50 font-semibold" : ""}
                                >
                                  <td className="py-1.5 text-sm text-zinc-900">{startRank + idx}</td>
                                  <td className="py-1.5 text-sm text-zinc-900 max-w-[220px]">
                                    <span className="block truncate">{score.team_name}</span>
                                  </td>
                                  <td className="py-1.5 text-sm text-zinc-900 text-right">{score.total_points}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs text-zinc-600 italic">No final results yet.</p>
                )}
              </div>

              {/* Trust Your Gut Gauge */}
              <div className="md:col-span-2 lg:col-span-3">
                {funStats && funStats.fixtures_scored > 0 ? (
                  <div className="rounded-lg border border-sky-200 bg-white ring-1 ring-sky-100 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xl font-bold">Trust Your Gut Gauge</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setGutScope("season");
                          setSelectedGutRoundId(null);
                        }}
                        className={`inline-flex items-center gap-2 rounded-md border-2 px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1 ${
                          gutScope === "season"
                            ? "bg-[#003A5D] text-white border-[#003A5D]"
                            : "bg-white text-[#003A5D] border-[#BFD9EA] hover:bg-[#E6F1F7]"
                        }`}
                      >
                        Season
                      </button>
                      <Select.Root
                        value={selectedGutRoundId ?? ""}
                        onValueChange={(value) => {
                          setGutScope("round");
                          setSelectedGutRoundId(value);
                        }}
                      >
                        <Select.Trigger
                          className={`inline-flex items-center justify-between gap-2 rounded-md border-2 px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1 min-w-[100px] max-w-[140px] ${
                            gutScope === "round"
                              ? "bg-[#003A5D] text-white border-[#003A5D]"
                              : "bg-white text-[#003A5D] border-[#BFD9EA] hover:bg-[#E6F1F7]"
                          }`}
                        >
                          <Select.Value placeholder="Round" />
                          <Select.Icon>
                            <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4 6H11L7.5 10.5L4 6Z" fill="currentColor" />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            position="popper"
                            side="bottom"
                            align="end"
                            sideOffset={6}
                            avoidCollisions={false}
                            className="max-h-[240px] overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                          >
                            <Select.Viewport
                              className="p-1 pr-1 max-h-[220px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                              style={{ scrollbarWidth: "thin" }}
                            >
                              {rounds.map((round) => (
                                <Select.Item
                                  key={round.id}
                                  value={round.id}
                                  className="relative flex items-center rounded-sm py-1.5 px-4 text-xs text-[#003A5D] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none cursor-pointer"
                                >
                                  <Select.ItemText>Round {round.round_number}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Calculated only when you edit a pick. Compares your first pick to your final pick (locked at kickoff).
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                    {/* Net Impact */}
                    <div className="rounded-md border border-sky-200 bg-white p-5">
                      <div className="grid grid-cols-2 gap-4 items-center">
                        {/* Left: Net */}
                        <div className="flex flex-col items-center justify-center h-[120px]">
                          <div className="text-xs text-slate-500">Net Points</div>
                          <div className={`mt-2 text-6xl font-extrabold leading-none ${(funStats.pointsGained - funStats.pointsLost) > 0 ? "text-green-600" : (funStats.pointsGained - funStats.pointsLost) < 0 ? "text-red-600" : "text-slate-900"}`}>
                            {(funStats.pointsGained - funStats.pointsLost) > 0 ? "+" : ""}{funStats.pointsGained - funStats.pointsLost}
                          </div>
                        </div>

                        {/* Right: Breakdown */}
                        <div className="text-sm">
                          <div className="text-xs text-slate-500 mb-2">Breakdown</div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Gained</span>
                            <span className="font-bold text-green-700">+{funStats.pointsGained}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-slate-600">Lost</span>
                            <span className="font-bold text-red-700">-{funStats.pointsLost}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Changes */}
                    <div className="rounded-md border border-sky-200 bg-white p-5">
                      <div className="grid grid-cols-2 gap-4 items-center">
                        {/* Left: total changes */}
                        <div className="flex flex-col items-center justify-center h-[120px]">
                          <div className="text-xs text-slate-500">Picks Changed</div>
                          <div className="mt-2 text-6xl font-extrabold leading-none text-slate-900">
                            {funStats.totalChanges}
                          </div>
                        </div>

                        {/* Right: breakdown */}
                        <div className="text-sm">
                          <div className="text-xs text-slate-500 mb-2">Change Outcome</div>
                          <div className="grid grid-cols-[1fr_auto] items-center">
                            <span className="text-slate-600">Initial Right</span>
                            <span className="font-bold tabular-nums text-right min-w-[2ch]">{funStats.gutFeelWins}</span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] items-center mt-1">
                            <span className="text-slate-600">Final Right</span>
                            <span className="font-bold tabular-nums text-right min-w-[2ch]">{funStats.secondGuessWins}</span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto] items-center mt-1">
                            <span className="text-slate-600">No Effect</span>
                            <span className="font-bold tabular-nums text-right min-w-[2ch]">{funStats.totalChanges - funStats.gutFeelWins - funStats.secondGuessWins}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-sky-200 bg-white ring-1 ring-sky-100 p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xl font-bold">Trust Your Gut Gauge</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setGutScope("season");
                          setSelectedGutRoundId(null);
                        }}
                        className={`inline-flex items-center gap-2 rounded-md border-2 px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1 ${
                          gutScope === "season"
                            ? "bg-[#003A5D] text-white border-[#003A5D]"
                            : "bg-white text-[#003A5D] border-[#BFD9EA] hover:bg-[#E6F1F7]"
                        }`}
                      >
                        Season
                      </button>
                      <Select.Root
                        value={selectedGutRoundId ?? ""}
                        onValueChange={(value) => {
                          setGutScope("round");
                          setSelectedGutRoundId(value);
                        }}
                      >
                        <Select.Trigger
                          className={`inline-flex items-center justify-between gap-2 rounded-md border-2 px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-1 min-w-[100px] max-w-[140px] ${
                            gutScope === "round"
                              ? "bg-[#003A5D] text-white border-[#003A5D]"
                              : "bg-white text-[#003A5D] border-[#BFD9EA] hover:bg-[#E6F1F7]"
                          }`}
                        >
                          <Select.Value placeholder="Round" />
                          <Select.Icon>
                            <svg width="10" height="10" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4 6H11L7.5 10.5L4 6Z" fill="currentColor" />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            position="popper"
                            side="bottom"
                            align="end"
                            sideOffset={6}
                            avoidCollisions={false}
                            className="max-h-[240px] overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                          >
                            <Select.Viewport
                              className="p-1 pr-1 max-h-[220px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                              style={{ scrollbarWidth: "thin" }}
                            >
                              {rounds.map((round) => (
                                <Select.Item
                                  key={round.id}
                                  value={round.id}
                                  className="relative flex items-center rounded-sm py-1.5 px-4 text-xs text-[#003A5D] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none cursor-pointer"
                                >
                                  <Select.ItemText>Round {round.round_number}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    Calculated only when you edit a pick. Compares your first pick to your final pick (locked at kickoff).
                  </div>
                  <p className="text-xs text-zinc-600 italic mt-4">No scored fixtures yet.</p>
                </div>
              )}
              </div>
            </div>
          </section>

          {/* Section Switcher */}
          <section className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => setActiveView("overall")}
                className={`rounded-md border p-4 text-center transition-colors ${
                  activeView === "overall"
                    ? "border-[#004165] bg-[#E6F1F7] text-[#003A5D] font-semibold"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Overall
              </button>
              <button
                onClick={() => setActiveView("rounds")}
                className={`rounded-md border p-4 text-center transition-colors ${
                  activeView === "rounds"
                    ? "border-[#004165] bg-[#E6F1F7] text-[#003A5D] font-semibold"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Rounds
              </button>
              <button
                onClick={() => setActiveView("categories")}
                className={`rounded-md border p-4 text-center transition-colors ${
                  activeView === "categories"
                    ? "border-[#004165] bg-[#E6F1F7] text-[#003A5D] font-semibold"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Categories
              </button>
            </div>
          </section>

          {/* Round Results Section */}
          {activeView === "rounds" && (
            <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#003A5D]">Round Results</h2>
              <div className="flex items-center gap-3">
                {rounds.length > 0 ? (
                  <Select.Root value={selectedRoundId || undefined} onValueChange={setSelectedRoundId}>
                  <Select.Trigger className="inline-flex items-center justify-between rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-[#003A5D] hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 min-w-[180px]">
                    <Select.Value placeholder="Round" />
                    <Select.Icon className="ml-2">
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 6H11L7.5 10.5L4 6Z" fill="currentColor" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content
                      position="popper"
                      side="bottom"
                      align="end"
                      sideOffset={6}
                      avoidCollisions={false}
                      className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                    >
                      <Select.Viewport
                        className="p-1 max-h-[240px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        {rounds.map((round) => (
                          <Select.Item
                            key={round.id}
                            value={round.id}
                            className="relative flex items-center rounded-sm py-2 px-8 text-sm text-[#003A5D] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none cursor-pointer"
                          >
                            <Select.ItemText>Round {round.round_number}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
                ) : (
                  <p className="text-sm text-zinc-600">No rounds available</p>
                )}
                {selectedRoundId && (
                  <PrintButton
                    onClick={() => window.open(`/print/leaderboard/round/${selectedRoundId}`, "_blank", "noopener,noreferrer")}
                  />
                )}
              </div>
            </div>

            {roundScores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 border border-zinc-300 rounded-md">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Team
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Business
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-300">
                        Category
                      </th>
                      <th className="px-4 py-3 w-[110px] text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-zinc-200">
                    {roundScores.map((score, index) => {
                      const business = businessNamesByParticipant[score.participant_id] || "—";
                      const category = score.category ? formatCategoryLabel(score.category) : "—";
                      return (
                        <tr key={score.participant_id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600 max-w-[260px]">
                            <span className="block truncate" title={business}>{business}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 max-w-[140px]">
                            <span className="block truncate" title={category}>{category}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap w-[110px] text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">No final results entered yet for this round.</p>
              </div>
            )}
          </section>
          )}

          {/* Overall Leaderboard Section */}
          {activeView === "overall" && (
            <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#003A5D]">Overall Leaderboard</h2>
              <PrintButton
                onClick={() => window.open(`/print/leaderboard/overall?leagueId=${participantLeagueId || ""}`, "_blank", "noopener,noreferrer")}
              />
            </div>
            {overallScores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 border border-zinc-300 rounded-md">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Rank
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Team
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Business
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-300">
                        Category
                      </th>
                      <th className="px-4 py-3 w-[110px] text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-zinc-200">
                    {overallScores.map((score, index) => {
                      const business = businessNamesByParticipant[score.participant_id] || "—";
                      const category = score.category ? formatCategoryLabel(score.category) : "—";
                      return (
                        <tr key={score.participant_id} className="hover:bg-zinc-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600 max-w-[260px]">
                            <span className="block truncate" title={business}>{business}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 max-w-[140px]">
                            <span className="block truncate" title={category}>{category}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap w-[110px] text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">No final results entered yet.</p>
              </div>
            )}
          </section>
          )}

          {/* Category Leaderboards Section */}
          {activeView === "categories" && categoryOptions.length > 0 && (
            <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-[#003A5D]">Category Leaderboards</h2>
                <div className="flex items-center gap-3">
                  <Select.Root value={selectedCategory} onValueChange={setSelectedCategory}>
                    <Select.Trigger className="inline-flex items-center justify-between rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-[#003A5D] hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 w-[240px]">
                      <Select.Value placeholder="Select a category" />
                      <Select.Icon className="ml-2">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 6H11L7.5 10.5L4 6Z" fill="currentColor" />
                        </svg>
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        avoidCollisions={false}
                        className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                      >
                        <Select.Viewport className="p-1 max-h-[300px] overflow-y-auto">
                          {categoryOptions.map((category) => (
                            <Select.Item
                              key={category}
                              value={category}
                              className="relative flex items-center rounded-sm py-2 px-8 text-sm text-[#003A5D] hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none cursor-pointer"
                            >
                              <Select.ItemText>{formatCategoryLabel(category)}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                  {selectedCategory && (
                    <PrintButton
                      onClick={() => window.open(`/print/leaderboard/category/${encodeURIComponent(selectedCategory)}?leagueId=${participantLeagueId || ""}`, "_blank", "noopener,noreferrer")}
                    />
                  )}
                </div>
              </div>

              {overallScores.length > 0 && selectedCategory ? (
                (() => {
                  const categoryScores = getCategoryScores(selectedCategory);
                  if (categoryScores.length === 0) {
                    return (
                      <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                        <p className="text-sm text-zinc-600">No teams in this category yet.</p>
                      </div>
                    );
                  }

                  const sortedScores = sortLeaderboardRows(categoryScores);

                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-zinc-200 border border-zinc-300 rounded-md">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                              Rank
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                              Team
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                              Total Points
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-zinc-200">
                          {sortedScores.map((score, index) => (
                            <tr key={score.participant_id} className="hover:bg-zinc-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                  <p className="text-sm text-zinc-600">No final results entered yet.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
