"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

// Table name constants (from project usage)
const FIXTURES_TABLE = "fixtures";

// Local team code to name mapping (fallback when teams table is not accessible)
const TEAM_NAMES: Record<string, string> = {
  BLU: "Blues",
  BRU: "Brumbies",
  CHI: "Chiefs",
  CRU: "Crusaders",
  DRU: "Drua",
  FOR: "Force",
  HIG: "Highlanders",
  HUR: "Hurricanes",
  MOA: "Moana Pasifika",
  RED: "Reds",
  WAR: "Waratahs",
};

type Participant = {
  id: string;
  name: string;
  business_name: string;
  team_name: string;
  category: string;
};

type ParticipantContact = {
  id: string;
  email: string;
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

type Team = {
  code: string;
  name: string;
  logo_path: string | null;
};

type Round = {
  id: string;
  season: number;
  round_number: number;
};

export default function TeamHomePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const participantId = params.id as string;
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [contacts, setContacts] = useState<ParticipantContact[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [nextRoundFixtures, setNextRoundFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWinnerByFixtureId, setSelectedWinnerByFixtureId] = useState<Record<string, string>>({});
  const [selectedMarginByFixtureId, setSelectedMarginByFixtureId] = useState<Record<string, string>>({});
  const [savingFixtureId, setSavingFixtureId] = useState<string | null>(null);
  const [savedFixtureIds, setSavedFixtureIds] = useState<Set<string>>(new Set());
  const [pickErrors, setPickErrors] = useState<Record<string, string>>({});
  const isInitializingRound = useRef(true);

  useEffect(() => {
    if (participantId) {
      fetchTeamData();
    }
  }, [participantId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch participant
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("id", participantId)
        .single();

      if (participantError) {
        console.error("Error fetching participant:", participantError);
        setError(`Error loading team: ${participantError.message}`);
        setLoading(false);
        return;
      }

      setParticipant(participantData);

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("participant_contacts")
        .select("id, email")
        .eq("participant_id", participantId)
        .order("email", { ascending: true });

      if (contactsError) {
        console.error("Error fetching contacts:", contactsError);
      } else {
        setContacts(contactsData || []);
      }

      // Fetch rounds for current season (default to current year)
      const currentSeason = new Date().getFullYear();
      const roundsRes = await supabase
        .from("rounds")
        .select("id, season, round_number")
        .eq("season", currentSeason)
        .order("round_number", { ascending: true });

      if (roundsRes.error) {
        console.warn("Error fetching rounds:", roundsRes.error);
      } else {
        setRounds(roundsRes.data || []);
      }

      // Find next round from fixtures only
      const nowISO = new Date().toISOString();
      const upcomingFixturesRes = await supabase
        .from(FIXTURES_TABLE)
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .gt("kickoff_at", nowISO)
        .order("kickoff_at", { ascending: true })
        .limit(10);

      let defaultRoundId: string | null = null;

      if (upcomingFixturesRes.error) {
        console.warn("Error fetching upcoming fixtures:", upcomingFixturesRes.error);
      } else if (upcomingFixturesRes.data && upcomingFixturesRes.data.length > 0) {
        // Identify the next round from the earliest upcoming fixture
        const earliestFixture = upcomingFixturesRes.data[0];
        defaultRoundId = earliestFixture.round_id || null;
        setActiveRoundId(defaultRoundId);
      }

      // Determine selected round: URL param > next round > first round
      const urlRoundId = searchParams.get("roundId");
      const roundsList = roundsRes.data || [];
      
      // Validate URL roundId exists in rounds list
      const validUrlRoundId = urlRoundId && roundsList.some((r) => r.id === urlRoundId) ? urlRoundId : null;
      
      const initialRoundId = validUrlRoundId || defaultRoundId || (roundsList.length > 0 ? roundsList[0].id : null);
      
      // Set initial round only once during initialization
      if (initialRoundId && isInitializingRound.current) {
        isInitializingRound.current = false;
        setSelectedRoundId(initialRoundId);
      }

      // Fetch fixtures for selected round
      if (initialRoundId) {
        const fixturesRes = await supabase
          .from(FIXTURES_TABLE)
          .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
          .eq("round_id", initialRoundId)
          .order("kickoff_at", { ascending: true });

        if (fixturesRes.error) {
          console.warn("Error fetching fixtures for round:", fixturesRes.error);
          setNextRoundFixtures([]);
        } else {
          setNextRoundFixtures(fixturesRes.data || []);
        }
      } else {
        setNextRoundFixtures([]);
      }

      // Fetch teams for logos
      await fetchTeams();

      // Fetch picks for this participant
      await fetchPicks();
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("super_rugby_teams")
        .select("code, name, logo_path")
        .order("sort_order", { ascending: true });

      if (error) {
        console.warn("Error fetching teams:", error);
        return;
      }

      const teamsMap: Record<string, Team> = {};
      (data || []).forEach((team: Team) => {
        teamsMap[team.code] = team;
      });
      setTeams(teamsMap);
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const fetchPicks = async () => {
    try {
      const response = await fetch(`/api/picks?participantId=${participantId}`);
      if (!response.ok) {
        const data = await response.json();
        console.warn("Error fetching picks:", data.error);
        return;
      }
      const data = await response.json();
      const picksMap: Record<string, Pick> = {};
      const winnerMap: Record<string, string> = {};
      const marginMap: Record<string, string> = {};
      
      (data.picks || []).forEach((pick: Pick) => {
        picksMap[pick.fixture_id] = pick;
        winnerMap[pick.fixture_id] = pick.picked_team;
        // Convert integer margin to margin band: 1-12 -> "1-12", 13+ -> "13+"
        if (pick.margin >= 1 && pick.margin <= 12) {
          marginMap[pick.fixture_id] = "1-12";
        } else if (pick.margin >= 13) {
          marginMap[pick.fixture_id] = "13+";
        }
      });
      
      setPicks(picksMap);
      setSelectedWinnerByFixtureId(winnerMap);
      setSelectedMarginByFixtureId(marginMap);
    } catch (err) {
      console.error("Error fetching picks:", err);
    }
  };

  // Handle round selection change - sync selectedRoundId to URL
  useEffect(() => {
    // Skip during initialization to avoid loops
    if (isInitializingRound.current) {
      return;
    }

    // Extract roundId from URL as primitive to avoid object identity issues
    const urlRoundId = searchParams.get("roundId");
    
    // Only update URL if selectedRoundId differs from URL
    if (selectedRoundId && selectedRoundId !== urlRoundId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("roundId", selectedRoundId);
      router.replace(`?${params.toString()}`, { scroll: false });
    } else if (!selectedRoundId && urlRoundId) {
      // Clear URL param if selectedRoundId is cleared
      const params = new URLSearchParams(searchParams.toString());
      params.delete("roundId");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedRoundId, searchParams, router]);

  // Fetch fixtures when selectedRoundId changes (but not on initial mount if already fetched)
  const [hasInitialFetch, setHasInitialFetch] = useState(false);
  
  useEffect(() => {
    if (selectedRoundId) {
      // Skip fetch if this is the initial load and we already fetched in fetchTeamData
      if (!hasInitialFetch) {
        setHasInitialFetch(true);
        return;
      }

      // Fetch fixtures for selected round
      const fetchRoundFixtures = async () => {
        const fixturesRes = await supabase
          .from(FIXTURES_TABLE)
          .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
          .eq("round_id", selectedRoundId)
          .order("kickoff_at", { ascending: true });

        if (fixturesRes.error) {
          console.warn("Error fetching fixtures for round:", fixturesRes.error);
          setNextRoundFixtures([]);
        } else {
          setNextRoundFixtures(fixturesRes.data || []);
        }
      };

      fetchRoundFixtures();
    }
  }, [selectedRoundId, hasInitialFetch]);

  const DRAW_VALUE = "DRAW";

  const handleSetWinner = (fixtureId: string, teamCode: string) => {
    setSelectedWinnerByFixtureId((prev) => ({
      ...prev,
      [fixtureId]: teamCode,
    }));
    // Clear margin if Draw is selected
    if (teamCode === DRAW_VALUE) {
      setSelectedMarginByFixtureId((prev) => {
        const next = { ...prev };
        delete next[fixtureId];
        return next;
      });
    }
  };

  const handleSetMargin = (fixtureId: string, marginBand: string) => {
    setSelectedMarginByFixtureId((prev) => ({
      ...prev,
      [fixtureId]: marginBand,
    }));
  };

  const handleSavePick = async (fixture: Fixture) => {
    const winner = selectedWinnerByFixtureId[fixture.id];
    const marginBand = selectedMarginByFixtureId[fixture.id];

    if (!winner) {
      return; // Validation will be handled by API, but basic check here
    }

    // If Draw is selected, margin is not required (will be 0)
    if (winner === DRAW_VALUE) {
      // Draw pick: margin is 0
      const margin = 0;

      setSavingFixtureId(fixture.id);

      const requestPayload = {
        participantId,
        fixtureId: fixture.id,
        pickedTeamCode: DRAW_VALUE,
        pickedMargin: margin,
      };

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Error saving pick:", {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        console.error("Request payload:", requestPayload);
        // Show user-friendly error message
        const errorMessage = data?.error ?? `${response.status} ${response.statusText}`;
        setPickErrors((prev) => ({
          ...prev,
          [fixture.id]: errorMessage,
        }));
        // Clear error after 5 seconds
        setTimeout(() => {
          setPickErrors((prev) => {
            const next = { ...prev };
            delete next[fixture.id];
            return next;
          });
        }, 5000);
        setSavingFixtureId(null);
        return;
      }

      // Clear any previous error for this fixture
      setPickErrors((prev) => {
        const next = { ...prev };
        delete next[fixture.id];
        return next;
      });

      // Refresh picks
      await fetchPicks();
      
      // Show saved indication
      setSavedFixtureIds((prev) => new Set(prev).add(fixture.id));
      setTimeout(() => {
        setSavedFixtureIds((prev) => {
          const next = new Set(prev);
          next.delete(fixture.id);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error("Error submitting pick:", err);
    } finally {
      setSavingFixtureId(null);
    }
      return;
    }

    // Team pick: margin is required
    if (!marginBand) {
      return; // Validation will be handled by API, but basic check here
    }

    // Convert margin band to integer: "1-12" -> 6, "13+" -> 13
    let margin = 0;
    if (marginBand === "1-12") {
      margin = 6; // Use middle of range
    } else if (marginBand === "13+") {
      margin = 13;
    }

    setSavingFixtureId(fixture.id);

    const requestPayload = {
      participantId,
      fixtureId: fixture.id,
      pickedTeamCode: winner,
      pickedMargin: margin,
    };

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Error saving pick:", {
          status: response.status,
          statusText: response.statusText,
          data,
        });
        console.error("Request payload:", requestPayload);
        // Show user-friendly error message
        const errorMessage = data?.error ?? `${response.status} ${response.statusText}`;
        setPickErrors((prev) => ({
          ...prev,
          [fixture.id]: errorMessage,
        }));
        // Clear error after 5 seconds
        setTimeout(() => {
          setPickErrors((prev) => {
            const next = { ...prev };
            delete next[fixture.id];
            return next;
          });
        }, 5000);
        setSavingFixtureId(null);
        return;
      }

      // Clear any previous error for this fixture
      setPickErrors((prev) => {
        const next = { ...prev };
        delete next[fixture.id];
        return next;
      });

      // Refresh picks
      await fetchPicks();
      
      // Show saved indication
      setSavedFixtureIds((prev) => new Set(prev).add(fixture.id));
      setTimeout(() => {
        setSavedFixtureIds((prev) => {
          const next = new Set(prev);
          next.delete(fixture.id);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error("Error submitting pick:", err);
    } finally {
      setSavingFixtureId(null);
    }
  };

  const formatKickoff = (kickoffAt: string | null) => {
    if (!kickoffAt) return "TBD";
    const date = new Date(kickoffAt);
    return date.toLocaleString("en-NZ", {
      timeZone: "Pacific/Auckland",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isFixtureLocked = (kickoffAt: string | null) => {
    if (!kickoffAt) return false;
    return new Date() >= new Date(kickoffAt);
  };

  const getTeamLogoUrl = (logoPath: string | null): string | null => {
    if (!logoPath) return null;
    // If logo_path starts with /, treat as public path
    if (logoPath.startsWith("/")) {
      return logoPath;
    }
    // Otherwise, try Supabase Storage public URL
    try {
      const { data } = supabase.storage.from("teams").getPublicUrl(logoPath);
      return data?.publicUrl || null;
    } catch {
      // Fallback to public path
      return logoPath.startsWith("http") ? logoPath : `/${logoPath}`;
    }
  };

  const hasOpenFixtures = () => {
    return nextRoundFixtures.some((fixture) => !isFixtureLocked(fixture.kickoff_at));
  };

  const canMakePicks = () => {
    // Allow picks if any fixture is open (not locked)
    return hasOpenFixtures();
  };

  const getFixtureStatus = (fixture: Fixture) => {
    // Only check fixture lock (per-fixture lockout)
    if (isFixtureLocked(fixture.kickoff_at)) {
      return "locked";
    }
    return "open";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">
            {error || "Team not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
            {participant.business_name} — {participant.team_name}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Welcome back. Your next picks are below.
          </p>
        </div>

        {/* Tiles */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Make Picks Tile */}
          <Link
            href={canMakePicks() ? "/picks" : "#"}
            className={`rounded-lg border p-6 shadow-sm transition-all ${
              canMakePicks()
                ? "cursor-pointer border-zinc-200 bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                : "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            }`}
            onClick={(e) => {
              if (!canMakePicks()) {
                e.preventDefault();
              }
            }}
          >
            <div className="mb-2 text-2xl">📝</div>
            <h3 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">
              Make Picks
            </h3>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              Submit your picks for upcoming games
            </p>
            {!canMakePicks() && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {nextRoundFixtures.length === 0
                  ? "No upcoming games"
                  : "All games locked"}
              </p>
            )}
          </Link>

          {/* Results Tile */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-2xl">📊</div>
            <h3 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">
              Results
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              View match results and scores
            </p>
          </div>

          {/* Team Settings Tile */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 text-2xl">⚙️</div>
            <h3 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">
              Team Settings
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Manage your team details
            </p>
          </div>
        </div>

        {/* Next Round Section */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              {selectedRoundId && rounds.length > 0
                ? (() => {
                    const selectedRound = rounds.find((r) => r.id === selectedRoundId);
                    return selectedRound ? `Round ${selectedRound.round_number}` : "Next Round";
                  })()
                : "Next Round"}
            </h2>
            {rounds.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="round-select" className="text-sm text-zinc-600 dark:text-zinc-400">
                  Round:
                </label>
                <select
                  id="round-select"
                  value={selectedRoundId || ""}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                >
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Round {round.round_number}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {nextRoundFixtures.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">
              No upcoming games scheduled yet.
            </p>
          ) : (
            <div className="space-y-4">
              {nextRoundFixtures.map((fixture) => {
                const homeTeam = teams[fixture.home_team_code];
                const awayTeam = teams[fixture.away_team_code];
                const homeName = homeTeam?.name || TEAM_NAMES[fixture.home_team_code] || fixture.home_team_code;
                const awayName = awayTeam?.name || TEAM_NAMES[fixture.away_team_code] || fixture.away_team_code;
                const status = getFixtureStatus(fixture);
                const kickoffStr = formatKickoff(fixture.kickoff_at);
                const isLocked = isFixtureLocked(fixture.kickoff_at);
                const selectedWinner = selectedWinnerByFixtureId[fixture.id] || "";
                const selectedMargin = selectedMarginByFixtureId[fixture.id] || "";
                const existingPick = picks[fixture.id];
                const effectiveWinner = selectedWinner || existingPick?.picked_team || null;
                const isDraw = effectiveWinner === "DRAW";
                const isSaved = savedFixtureIds.has(fixture.id);
                const isSaving = savingFixtureId === fixture.id;
                const hasExistingPick = !!picks[fixture.id];

                return (
                  <div key={fixture.id} className="flex justify-center">
                    <div
                      className={`w-full max-w-2xl rounded-xl border bg-white shadow-sm p-5 dark:border-zinc-800 dark:bg-zinc-900 ${isLocked ? "opacity-75" : ""}`}
                    >
                      {/* Card Header - Centered */}
                      <div className="mb-4 flex flex-col items-center text-center">
                        <div className="font-medium text-black dark:text-zinc-50 mb-2">
                          {homeName} vs {awayName}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                          {kickoffStr}
                        </div>
                        <div className="flex items-center gap-2">
                          {isLocked && (
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                              Locked
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              status === "open"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : status === "locked"
                                ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                            }`}
                          >
                            {status === "open"
                              ? "Open"
                              : status === "locked"
                              ? "Locked"
                              : "Not open yet"}
                          </span>
                        </div>
                      </div>

                    {/* Error Message */}
                    {pickErrors[fixture.id] && (
                      <div className="mb-4 rounded-md bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                        {pickErrors[fixture.id]}
                      </div>
                    )}

                    {/* Locked Pick Display */}
                    {isLocked && existingPick && (
                      <div className="mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                        Your pick: {teams[existingPick.picked_team]?.name || TEAM_NAMES[existingPick.picked_team] || existingPick.picked_team} by {existingPick.margin}
                      </div>
                    )}

                    {/* Centered Matchup Selection Row */}
                    {!isLocked && (
                      <div className="flex items-center justify-center gap-4 flex-wrap mb-4">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(fixture.id, fixture.home_team_code)}
                            disabled={isSaving || isLocked}
                            aria-label={`Pick ${homeName}`}
                            className={`relative h-28 w-28 sm:h-24 sm:w-24 flex items-center justify-center rounded-xl border bg-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                              effectiveWinner === fixture.home_team_code
                                ? "border-blue-600 ring-4 ring-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 dark:ring-blue-800"
                                : "border-zinc-300 hover:border-zinc-400 hover:shadow-md dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
                            } ${isSaving || isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            {homeTeam?.logo_path ? (
                              <img
                                src={getTeamLogoUrl(homeTeam.logo_path) || `/teams/${fixture.home_team_code}.svg`}
                                alt={homeName}
                                className="w-16 h-16 sm:w-14 sm:h-14 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                {fixture.home_team_code}
                              </span>
                            )}
                          </button>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Home</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetWinner(fixture.id, "DRAW")}
                          disabled={isSaving || isLocked}
                          aria-label="Pick Draw"
                          className={`relative h-28 w-20 sm:h-24 sm:w-16 flex items-center justify-center rounded-xl border bg-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            effectiveWinner === "DRAW"
                              ? "border-blue-600 ring-4 ring-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 dark:ring-blue-800"
                              : "border-zinc-300 hover:border-zinc-400 hover:shadow-md dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
                          } ${isSaving || isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        >
                          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Draw</span>
                        </button>
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(fixture.id, fixture.away_team_code)}
                            disabled={isSaving || isLocked}
                            aria-label={`Pick ${awayName}`}
                            className={`relative h-28 w-28 sm:h-24 sm:w-24 flex items-center justify-center rounded-xl border bg-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                              effectiveWinner === fixture.away_team_code
                                ? "border-blue-600 ring-4 ring-blue-200 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 dark:ring-blue-800"
                                : "border-zinc-300 hover:border-zinc-400 hover:shadow-md dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
                            } ${isSaving || isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            {awayTeam?.logo_path ? (
                              <img
                                src={getTeamLogoUrl(awayTeam.logo_path) || `/teams/${fixture.away_team_code}.svg`}
                                alt={awayName}
                                className="w-16 h-16 sm:w-14 sm:h-14 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                {fixture.away_team_code}
                              </span>
                            )}
                          </button>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Away</span>
                        </div>
                      </div>
                    )}

                    {/* Margin + Save Controls Row */}
                    {!isLocked && (
                      <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                        <select
                          value={selectedMargin}
                          onChange={(e) => handleSetMargin(fixture.id, e.target.value)}
                          disabled={isDraw || !effectiveWinner || isSaving || isLocked}
                          className={`rounded-md border px-3 py-1.5 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 ${
                            isDraw || !effectiveWinner || isSaving || isLocked
                              ? "cursor-not-allowed opacity-50 bg-zinc-100 border-zinc-300 dark:bg-zinc-900"
                              : hasExistingPick && selectedMargin
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-zinc-300"
                          }`}
                        >
                          <option value="">Select margin</option>
                          <option value="1-12">1-12</option>
                          <option value="13+">13+</option>
                        </select>
                        {hasExistingPick && (
                          <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                            Saved ✓
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSavePick(fixture)}
                          disabled={isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)}
                          className={`rounded-md px-4 py-1.5 text-sm text-white transition-colors ${
                            isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)
                              ? "cursor-not-allowed opacity-50 bg-zinc-400"
                              : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          {isSaving ? "Saving..." : isSaved ? "Saved" : hasExistingPick ? "Update Pick" : "Save"}
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Team Details Section */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
            Team Details
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Team Information
              </h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Business Name:
                  </span>{" "}
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {participant.business_name}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Team Name:
                  </span>{" "}
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {participant.team_name}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Category:
                  </span>{" "}
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {participant.category}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Contact Emails
              </h3>
              {contacts.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No contact emails registered
                </p>
              ) : (
                <ul className="space-y-1">
                  {contacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="text-sm text-zinc-900 dark:text-zinc-50"
                    >
                      {contact.email}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
