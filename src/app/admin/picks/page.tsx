"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSuperRugbyAdminCompetitionId } from "@/lib/superRugbyAdminScope";
import { calculatePickScore } from "@/lib/scoring";

type Round = {
  id: string;
  season: number;
  round_number: number;
};

type Participant = {
  id: string;
  team_name: string;
  league_id?: string;
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
  admin_override?: boolean;
  admin_override_reason?: string | null;
  admin_overridden_at?: string | null;
};

type Result = {
  fixture_id: string;
  winning_team: string;
  margin_band: string | null;
};

type PickDisplay = {
  matchLabel: string;
  fullMatchLabel: string;
  teamName: string;
  pickLabel: string; // 3-letter code or "—" when missing
  marginBand: string;
  updated: string;
  fixtureId: string;
  points: number | null;
  participantId: string;
  leagueId: string;
  pickedTeam: string;
  margin: number;
  hasPick: boolean;
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
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [overrideRow, setOverrideRow] = useState<PickDisplay | null>(null);
  const [overridePickedTeamCode, setOverridePickedTeamCode] = useState<string>("");
  const [overrideMargin, setOverrideMargin] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Reminder (round pick status)
  const [roundStatusLoading, setRoundStatusLoading] = useState(false);
  const [roundStatusError, setRoundStatusError] = useState<string | null>(null);
  const [roundStatusTotals, setRoundStatusTotals] = useState<{
    total_games: number;
    open_games: number;
    participant_count: number;
    complete_open_count: number;
    incomplete_open_count: number;
  } | null>(null);
  const [roundStatusRows, setRoundStatusRows] = useState<
    Array<{
      participant_id: string;
      team_name: string;
      picks_total: number;
      picks_open: number;
      total_games: number;
      open_games: number;
      missing_open: number;
      is_complete_open: boolean;
      emails: string[];
    }>
  >([]);
  const [reminderCopied, setReminderCopied] = useState(false);

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
      const compId = await getSuperRugbyAdminCompetitionId(supabase);
      if (!compId) {
        console.error("Super Rugby league ANZ2026 not found");
        setRounds([]);
        return;
      }

      const { data, error } = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .eq("competition_id", compId)
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

        const compId = await getSuperRugbyAdminCompetitionId(supabase);

        // Query fixtures for all rounds to find which ones have fixtures
        const fixturesQuery = supabase
          .from("fixtures")
          .select("round_id")
          .in("round_id", roundIds);
        const { data: fixturesData, error: fixturesError } = compId
          ? await fixturesQuery.eq("competition_id", compId)
          : await fixturesQuery;

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
  }, [selectedRoundId, refreshCounter]);

  // Fetch round pick status (reminder) when round changes
  useEffect(() => {
    if (!selectedRoundId) {
      setRoundStatusTotals(null);
      setRoundStatusRows([]);
      setRoundStatusError(null);
      return;
    }

    async function fetchRoundStatus() {
      setRoundStatusLoading(true);
      setRoundStatusError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setRoundStatusError("Not authenticated");
          setRoundStatusLoading(false);
          return;
        }

        const res = await fetch(
          `/api/admin/round-pick-status?roundId=${selectedRoundId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setRoundStatusError(err.error || "Failed to fetch round status");
          setRoundStatusTotals(null);
          setRoundStatusRows([]);
          setRoundStatusLoading(false);
          return;
        }

        const data = await res.json();
        setRoundStatusTotals(data.totals || null);
        setRoundStatusRows(data.rows || []);
        setRoundStatusError(null);
      } catch (e) {
        setRoundStatusError(e instanceof Error ? e.message : "Failed to fetch");
        setRoundStatusTotals(null);
        setRoundStatusRows([]);
      } finally {
        setRoundStatusLoading(false);
      }
    }

    fetchRoundStatus();
  }, [selectedRoundId]);

  function buildDisplayPicks(picksData: Pick[], fixtureIds: string[]) {
    const participantMap: Record<string, { team_name: string; league_id: string }> = {};
    participants.forEach((p) => {
      participantMap[p.id] = { team_name: p.team_name, league_id: p.league_id ?? "" };
    });

    const fixtureMap: Record<string, Fixture> = {};
    fixtures.forEach((f) => {
      fixtureMap[f.id] = f;
    });

    const pickMap: Record<string, Pick> = {};
    picksData.forEach((p) => {
      pickMap[`${p.participant_id}:${p.fixture_id}`] = p;
    });

    const display: PickDisplay[] = [];

    participants.forEach((participant) => {
      fixtures.forEach((fixture) => {
        const pick = pickMap[`${participant.id}:${fixture.id}`];
        const homeCode = fixture.home_team_code;
        const awayCode = fixture.away_team_code;

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

        const compactMatchLabel = `M${fixture.match_number}: ${homeCode} vs ${awayCode}${kickoffStr ? ` (${kickoffStr})` : ""}`;
        const homeTeam = teams[fixture.home_team_code];
        const awayTeam = teams[fixture.away_team_code];
        const homeName = homeTeam?.name || fixture.home_team_code;
        const awayName = awayTeam?.name || fixture.away_team_code;
        const fullMatchLabel = `Match ${fixture.match_number}: ${homeName} vs ${awayName}${kickoffStr ? ` (${kickoffStr})` : ""}`;
        const teamName = participantMap[participant.id]?.team_name ?? "Unknown";
        const leagueId = participantMap[participant.id]?.league_id ?? "";

        if (!pick) {
          display.push({
            matchLabel: compactMatchLabel,
            fullMatchLabel,
            teamName,
            pickLabel: "—",
            marginBand: "—",
            updated: "—",
            fixtureId: fixture.id,
            points: null,
            participantId: participant.id,
            leagueId,
            pickedTeam: "",
            margin: 0,
            hasPick: false,
          });
          return;
        }

        let pickLabel = pick.picked_team === "DRAW" ? "DRAW" : pick.picked_team;
        let marginBand = "—";
        if (pick.picked_team !== "DRAW") {
          if (pick.margin === 1) marginBand = "1-12";
          else if (pick.margin === 13) marginBand = "13+";
        }

        const updatedDate = pick.updated_at ? new Date(pick.updated_at) : new Date(pick.created_at);
        const updated = updatedDate.toLocaleString("en-NZ", {
          timeZone: "Pacific/Auckland",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        });

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
          leagueId,
          pickedTeam: pick.picked_team,
          margin: pick.margin,
          hasPick: true,
        });
      });
    });

    display.sort((a, b) => {
      const fixtureA = fixtureMap[a.fixtureId];
      const fixtureB = fixtureMap[b.fixtureId];
      if (!fixtureA || !fixtureB) return 0;
      if (fixtureA.match_number !== fixtureB.match_number) {
        return fixtureA.match_number - fixtureB.match_number;
      }
      const timeA = fixtureA.kickoff_at ? new Date(fixtureA.kickoff_at).getTime() : 0;
      const timeB = fixtureB.kickoff_at ? new Date(fixtureB.kickoff_at).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.teamName.localeCompare(b.teamName);
    });

    setDisplayPicks(display);
  }

  // Rebuild display picks when picks, fixtures, participants, teams, or results change (include missing picks)
  useEffect(() => {
    if (fixtures.length > 0 && participants.length > 0) {
      buildDisplayPicks(picks, fixtures.map((f) => f.id));
    } else {
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

  const openOverrideModal = (row: PickDisplay) => {
    const fixture = fixtures.find((f) => f.id === row.fixtureId);
    setOverrideRow(row);
    setOverridePickedTeamCode(row.hasPick ? row.pickedTeam : "");
    setOverrideMargin(row.hasPick && row.pickedTeam !== "DRAW" ? row.margin : null);
    setOverrideReason("");
    setOverrideError(null);
  };

  const closeOverrideModal = () => {
    setOverrideRow(null);
    setOverridePickedTeamCode("");
    setOverrideMargin(null);
    setOverrideReason("");
    setOverrideError(null);
  };

  const handleOverrideSubmit = async () => {
    if (!overrideRow) return;
    const fixture = fixtures.find((f) => f.id === overrideRow.fixtureId);
    if (!fixture) return;
    if (!overridePickedTeamCode || (overridePickedTeamCode !== "DRAW" && (overrideMargin !== 1 && overrideMargin !== 13))) return;

    setOverrideLoading(true);
    setOverrideError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch("/api/admin/override-pick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          participant_id: overrideRow.participantId,
          fixture_id: overrideRow.fixtureId,
          action: "upsert",
          picked_team_code: overridePickedTeamCode,
          margin: overridePickedTeamCode === "DRAW" ? 0 : overrideMargin,
          ...(overrideReason.trim() ? { reason: overrideReason.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setOverrideError(data?.error ?? "Override failed");
        setOverrideLoading(false);
        return;
      }
      closeOverrideModal();
      setRefreshCounter((c) => c + 1);
    } catch (err) {
      setOverrideError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setOverrideLoading(false);
    }
  };

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

        {/* Reminder panel */}
        {selectedRoundId && (
          <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
              Reminder
            </h3>
            {roundStatusLoading ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</p>
            ) : roundStatusError ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">{roundStatusError}</p>
            ) : roundStatusTotals ? (
              <>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  <span>Open complete: {roundStatusTotals.complete_open_count} / {roundStatusTotals.participant_count}</span>
                  <span>Open incomplete: {roundStatusTotals.incomplete_open_count}</span>
                  <span>Open games remaining: {roundStatusTotals.open_games}</span>
                  <span>Total games in round: {roundStatusTotals.total_games}</span>
                </div>
                {roundStatusTotals.open_games === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">No open games remaining for this round.</p>
                ) : roundStatusTotals.incomplete_open_count === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Everyone is done for the remaining open games.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-1 pr-2 font-medium text-zinc-900 dark:text-zinc-50">Team</th>
                            <th className="text-left py-1 pr-2 font-medium text-zinc-900 dark:text-zinc-50">Overall</th>
                            <th className="text-left py-1 pr-2 font-medium text-zinc-900 dark:text-zinc-50">Open</th>
                            <th className="text-left py-1 pr-2 font-medium text-zinc-900 dark:text-zinc-50">Missing open</th>
                            <th className="text-left py-1 font-medium text-zinc-900 dark:text-zinc-50">Emails</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roundStatusRows
                            .filter((r) => r.missing_open > 0)
                            .map((r) => (
                              <tr key={r.participant_id} className="border-b border-zinc-100 dark:border-zinc-800">
                                <td className="py-1 pr-2 text-zinc-900 dark:text-zinc-50">{r.team_name}</td>
                                <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">{r.picks_total}/{r.total_games}</td>
                                <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">{r.picks_open}/{r.open_games}</td>
                                <td className="py-1 pr-2 text-zinc-700 dark:text-zinc-300">{r.missing_open}</td>
                                <td className="py-1 text-xs text-zinc-600 dark:text-zinc-400">{r.emails.join(", ")}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const emails = roundStatusRows
                          .filter((r) => r.missing_open > 0)
                          .flatMap((r) => r.emails);
                        const deduped = [...new Set(emails)].join("; ");
                        await navigator.clipboard.writeText(deduped);
                        setReminderCopied(true);
                        setTimeout(() => setReminderCopied(false), 1000);
                      }}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {reminderCopied ? "Copied" : "Copy BCC (incomplete)"}
                    </button>
                  </>
                )}
              </>
            ) : null}
          </div>
        )}

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
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Override
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
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Override
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
                      <th className="px-4 py-1.5 text-left text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                        Override
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {filteredPicks.map((pick) => (
                  <tr key={`${pick.participantId}:${pick.fixtureId}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
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
                        <td className="px-4 py-1.5">
                          <button
                            type="button"
                            onClick={() => openOverrideModal(pick)}
                            className="rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          >
                            Override
                          </button>
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
                        <td className="px-4 py-1.5">
                          <button
                            type="button"
                            onClick={() => openOverrideModal(pick)}
                            className="rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          >
                            Override
                          </button>
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
                        <td className="px-4 py-1.5">
                          <button
                            type="button"
                            onClick={() => openOverrideModal(pick)}
                            className="rounded-md border border-amber-500 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          >
                            Override
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Override pick modal */}
        {overrideRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2">Override pick</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                {overrideRow.teamName} — {overrideRow.fullMatchLabel}
              </p>
              {overrideError && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {overrideError}
                </div>
              )}
              {(() => {
                const fixture = fixtures.find((f) => f.id === overrideRow.fixtureId);
                if (!fixture) return null;
                return (
                  <>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Pick</label>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setOverridePickedTeamCode(fixture.home_team_code); setOverrideMargin(1); }}
                          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                            overridePickedTeamCode === fixture.home_team_code ? "bg-blue-600 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {teams[fixture.home_team_code]?.name ?? fixture.home_team_code}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOverridePickedTeamCode(fixture.away_team_code); setOverrideMargin(1); }}
                          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                            overridePickedTeamCode === fixture.away_team_code ? "bg-blue-600 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {teams[fixture.away_team_code]?.name ?? fixture.away_team_code}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOverridePickedTeamCode("DRAW"); setOverrideMargin(0); }}
                          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                            overridePickedTeamCode === "DRAW" ? "bg-blue-600 text-white" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          Draw
                        </button>
                      </div>
                    </div>
                    {overridePickedTeamCode && overridePickedTeamCode !== "DRAW" && (
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Margin</label>
                        <select
                          value={overrideMargin ?? ""}
                          onChange={(e) => setOverrideMargin(e.target.value === "" ? null : Number(e.target.value))}
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                        >
                          <option value="1">1–12</option>
                          <option value="13">13+</option>
                        </select>
                      </div>
                    )}
                  </>
                );
              })()}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Audit reason"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeOverrideModal}
                  disabled={overrideLoading}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleOverrideSubmit}
                  disabled={
                    overrideLoading ||
                    !overridePickedTeamCode ||
                    (overridePickedTeamCode !== "DRAW" && (overrideMargin !== 1 && overrideMargin !== 13))
                  }
                  className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {overrideLoading ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
