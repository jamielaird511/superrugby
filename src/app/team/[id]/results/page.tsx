"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import TeamNav from "@/components/TeamNav";
import * as Select from "@radix-ui/react-select";
import { calculatePickScore } from "@/lib/scoring";

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
  let endIndex = Math.min(sortedRows.length, startIndex + windowSize);

  // Adjust if we hit the end
  if (endIndex - startIndex < windowSize) {
    startIndex = Math.max(0, endIndex - windowSize);
  }

  return {
    windowRows: sortedRows.slice(startIndex, endIndex),
    startRank: startIndex + 1,
  };
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
  const [roundPicks, setRoundPicks] = useState<Pick[]>([]);
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [roundResults, setRoundResults] = useState<Record<string, Result>>({});
  const [allResults, setAllResults] = useState<Record<string, Result>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});

  // Computed scores
  const [roundScores, setRoundScores] = useState<RoundScore[]>([]);
  const [overallScores, setOverallScores] = useState<OverallScore[]>([]);

  // Snapshot round state (independent from main round selector)
  const [snapshotRoundId, setSnapshotRoundId] = useState<string | null>(null);
  const [snapshotRoundFixtures, setSnapshotRoundFixtures] = useState<Fixture[]>([]);
  const [snapshotRoundPicks, setSnapshotRoundPicks] = useState<Pick[]>([]);
  const [snapshotRoundResults, setSnapshotRoundResults] = useState<Record<string, Result>>({});
  const [snapshotRoundScores, setSnapshotRoundScores] = useState<RoundScore[]>([]);

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
    mostIndecisive: any;
  } | null>(null);

  const handleLogout = async () => {
    localStorage.removeItem("participant_id");
    router.push("/");
  };

  useEffect(() => {
    if (participantId) {
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

  useEffect(() => {
    if (participantId) {
      fetchFunStats();
    }
  }, [participantId]);

  const fetchFunStats = async () => {
    try {
      const response = await fetch(`/api/fun-stats?participantId=${participantId}&mode=season`);
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

  useEffect(() => {
    // Calculate round scores when round data changes
    if (roundFixtures.length > 0 && roundPicks.length > 0) {
      const scores = calculateRoundScores(roundFixtures, roundPicks, roundResults);
      // Enrich with participant names and categories
      const enrichedScores = scores.map((score) => {
        const p = participants.find((p) => p.id === score.participant_id);
        return {
          ...score,
          team_name: p?.team_name || "Unknown",
          category: p?.category || null,
        };
      });
      // Use consistent sorting with tie-breakers
      setRoundScores(sortLeaderboardRows(enrichedScores));
    } else {
      setRoundScores([]);
    }
  }, [roundFixtures, roundPicks, roundResults, participants]);

  useEffect(() => {
    // Calculate snapshot round scores when snapshot round data changes
    if (snapshotRoundFixtures.length > 0 && snapshotRoundPicks.length > 0) {
      const scores = calculateRoundScores(snapshotRoundFixtures, snapshotRoundPicks, snapshotRoundResults);
      // Enrich with participant names and categories
      const enrichedScores = scores.map((score) => {
        const p = participants.find((p) => p.id === score.participant_id);
        return {
          ...score,
          team_name: p?.team_name || "Unknown",
          category: p?.category || null,
        };
      });
      // Use consistent sorting with tie-breakers
      setSnapshotRoundScores(sortLeaderboardRows(enrichedScores));
    } else {
      setSnapshotRoundScores([]);
    }
  }, [snapshotRoundFixtures, snapshotRoundPicks, snapshotRoundResults, participants]);

  useEffect(() => {
    // Calculate overall scores when all data changes
    if (allFixtures.length > 0 && allPicks.length > 0) {
      const scores = calculateOverallScores(allFixtures, allPicks, allResults);
      // Enrich with participant names and categories
      const enrichedScores = scores.map((score) => {
        const p = participants.find((p) => p.id === score.participant_id);
        return {
          ...score,
          team_name: p?.team_name || "Unknown",
          category: p?.category || null,
        };
      });
      // Use consistent sorting with tie-breakers
      setOverallScores(sortLeaderboardRows(enrichedScores));
    } else {
      setOverallScores([]);
    }
  }, [allFixtures, allPicks, allResults, participants]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch current participant
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id, business_name, team_name, category")
        .eq("id", participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant({
        id: participantData.id,
        team_name: participantData.team_name,
        category: participantData.category,
      });

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

      // Fetch rounds for current season
      const currentSeason = new Date().getFullYear();
      const { data: roundsData, error: roundsError } = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .eq("season", currentSeason)
        .order("round_number", { ascending: true });

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

      // Set default selected round to first round
      if (roundsData && roundsData.length > 0) {
        setSelectedRoundId(roundsData[0].id);
        setSnapshotRoundId(roundsData[0].id);
      }

      // Fetch all fixtures for current season
      const { data: allFixturesData, error: allFixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .in(
          "round_id",
          (roundsData || []).map((r) => r.id)
        )
        .order("kickoff_at", { ascending: true });

      if (allFixturesError) throw allFixturesError;
      setAllFixtures(allFixturesData || []);

      // Fetch all picks
      const { data: picksData, error: picksError } = await supabase
        .from("picks")
        .select("fixture_id, participant_id, picked_team, margin");

      if (picksError) {
        console.warn("Error fetching picks:", picksError);
      } else {
        setAllPicks(
          (picksData || []).map((p) => ({
            fixture_id: p.fixture_id,
            participant_id: p.participant_id,
            picked_team: p.picked_team,
            margin: p.margin,
          }))
        );
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
    try {
      // Fetch fixtures for selected round
      const { data: fixturesData, error: fixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .order("match_number", { ascending: true });

      if (fixturesError) throw fixturesError;
      setRoundFixtures(fixturesData || []);

      // Fetch picks for this round
      const fixtureIds = (fixturesData || []).map((f) => f.id);
      if (fixtureIds.length > 0) {
        const { data: picksData, error: picksError } = await supabase
          .from("picks")
          .select("fixture_id, participant_id, picked_team, margin")
          .in("fixture_id", fixtureIds);

        if (picksError) {
          console.warn("Error fetching round picks:", picksError);
          setRoundPicks([]);
        } else {
          setRoundPicks(
            (picksData || []).map((p) => ({
              fixture_id: p.fixture_id,
              participant_id: p.participant_id,
              picked_team: p.picked_team,
              margin: p.margin,
            }))
          );
        }

        // Fetch results for this round
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
        setRoundPicks([]);
        setRoundResults({});
      }
    } catch (err) {
      console.error("Error fetching round data:", err);
    }
  };

  const fetchSnapshotRoundData = async (roundId: string) => {
    try {
      // Fetch fixtures for snapshot round
      const { data: fixturesData, error: fixturesError } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .order("match_number", { ascending: true });

      if (fixturesError) throw fixturesError;
      setSnapshotRoundFixtures(fixturesData || []);

      // Fetch picks for this round
      const fixtureIds = (fixturesData || []).map((f) => f.id);
      if (fixtureIds.length > 0) {
        const { data: picksData, error: picksError } = await supabase
          .from("picks")
          .select("fixture_id, participant_id, picked_team, margin")
          .in("fixture_id", fixtureIds);

        if (picksError) {
          console.warn("Error fetching snapshot round picks:", picksError);
          setSnapshotRoundPicks([]);
        } else {
          setSnapshotRoundPicks(
            (picksData || []).map((p) => ({
              fixture_id: p.fixture_id,
              participant_id: p.participant_id,
              picked_team: p.picked_team,
              margin: p.margin,
            }))
          );
        }

        // Fetch results for this round
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
        setSnapshotRoundPicks([]);
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
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 xl:px-16">
          <h1 className="text-3xl font-semibold text-[#003A5D] mb-6">Results</h1>

          {/* Summary Section */}
          <section className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Overall Snapshot */}
              <div className="rounded-md border border-zinc-300 bg-white p-4">
                <h3 className="text-lg font-semibold text-[#003A5D] mb-1">Overall Snapshot</h3>
                <p className="text-xs text-zinc-600 mb-3">5-team context around you</p>
                {hasFinalResults(allResults) ? (
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
                                  <td className="py-1.5 text-sm text-zinc-900">{score.team_name}</td>
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
              <div className="rounded-md border border-zinc-300 bg-white p-4">
                <h3 className="text-lg font-semibold text-[#003A5D] mb-1">Category Snapshot</h3>
                <p className="text-xs text-zinc-600 mb-3">5-team context around you</p>
                {hasFinalResults(allResults) && participant?.category ? (
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
                                  <td className="py-1.5 text-sm text-zinc-900">{score.team_name}</td>
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
              <div className="rounded-md border border-zinc-300 bg-white p-4">
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
                      <Select.Content className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50">
                        <Select.Viewport className="p-1 max-h-[200px] overflow-y-auto">
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
                {hasFinalResults(snapshotRoundResults) ? (
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
                                  <td className="py-1.5 text-sm text-zinc-900">{score.team_name}</td>
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

              {/* Gut Feel Stats */}
              <div className="rounded-md border border-zinc-300 bg-white p-4">
                <h3 className="text-lg font-semibold text-[#003A5D] mb-1">Gut Feel</h3>
                <p className="text-xs text-zinc-600 mb-3">First instinct vs final pick</p>
                {funStats && funStats.fixtures_scored > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">Points gained:</span>
                      <span className="font-semibold text-green-600">{funStats.pointsGained}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">Points lost:</span>
                      <span className="font-semibold text-red-600">{funStats.pointsLost}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">Gut feel wins:</span>
                      <span className="font-semibold text-zinc-900">{funStats.gutFeelWins}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">Second guess wins:</span>
                      <span className="font-semibold text-zinc-900">{funStats.secondGuessWins}</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1 border-t border-zinc-200">
                      <span className="text-zinc-600">Total changes:</span>
                      <span className="font-semibold text-zinc-900">{funStats.totalChanges}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 italic">No scored fixtures yet.</p>
                )}
              </div>
            </div>
          </section>

          {/* Round Results Section */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Round Results</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">Select Round</label>
              {rounds.length > 0 ? (
                <Select.Root value={selectedRoundId || undefined} onValueChange={setSelectedRoundId}>
                  <Select.Trigger className="inline-flex items-center justify-between rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-[#003A5D] hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 min-w-[200px]">
                    <Select.Value placeholder="Select a round" />
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
                      avoidCollisions={true}
                      collisionPadding={12}
                      className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg z-50"
                    >
                      <Select.Viewport className="p-1 max-h-[300px] overflow-y-auto">
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
            </div>

            {hasFinalResults(roundResults) ? (
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
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-zinc-200">
                    {roundScores.map((score, index) => (
                      <tr key={score.participant_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900 text-right">{score.total_points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">No final results entered yet for this round.</p>
              </div>
            )}
          </section>

          {/* Overall Leaderboard Section */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Overall Leaderboard</h2>
            {hasFinalResults(allResults) ? (
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
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                        Total Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-zinc-200">
                    {overallScores.map((score, index) => (
                      <tr key={score.participant_id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600">{score.category || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-zinc-300 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">No final results entered yet.</p>
              </div>
            )}
          </section>

          {/* Category Leaderboards Section */}
          {categories.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-[#003A5D] mb-4">Category Leaderboards</h2>
              {hasFinalResults(allResults) ? (
                <div className="space-y-6">
                  {categories.map((category) => {
                    const categoryScores = getCategoryScores(category);
                    if (categoryScores.length === 0) return null;

                    return (
                      <div key={category}>
                        <h3 className="text-lg font-medium text-[#003A5D] mb-3">{category}</h3>
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
                              {categoryScores.map((score, index) => (
                                <tr key={score.participant_id} className="hover:bg-zinc-50">
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
