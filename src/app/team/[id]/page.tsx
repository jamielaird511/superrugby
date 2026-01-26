"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import * as Select from "@radix-ui/react-select";
import { PencilSquareIcon, ChartBarIcon, Cog6ToothIcon, LockClosedIcon, ArrowRightOnRectangleIcon, PrinterIcon } from "@heroicons/react/24/outline";
import TeamNav from "@/components/TeamNav";
import { calculatePickScore } from "@/lib/scoring";

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

type FixtureResult = {
  winning_team: string;
  margin_band: string | null;
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
  const [editingByMatchId, setEditingByMatchId] = useState<Record<string, boolean>>({});
  const [showOwnTeamNotice, setShowOwnTeamNotice] = useState(false);
  const [fixtureResults, setFixtureResults] = useState<Record<string, FixtureResult>>({});
  const isInitializingRound = useRef(true);

  useEffect(() => {
    if (participantId) {
      fetchTeamData();
    }
  }, [participantId]);

  // Handle notice query param
  useEffect(() => {
    const notice = searchParams.get("notice");
    if (notice === "own-team") {
      setShowOwnTeamNotice(true);
      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setShowOwnTeamNotice(false);
        // Remove query param without full reload
        const params = new URLSearchParams(searchParams.toString());
        params.delete("notice");
        const newUrl = params.toString() 
          ? `/team/${participantId}?${params.toString()}`
          : `/team/${participantId}`;
        router.replace(newUrl, { scroll: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, participantId, router]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // First, get the current auth user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // No user signed in, redirect to login
        router.push("/");
        return;
      }

      // Fetch the signed-in participant record by auth_user_id (NOT by route id)
      const { data: me, error: meErr } = await supabase
        .from("participants")
        .select("id, team_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (meErr || !me) {
        setError("You're signed in but your team link is missing. Please log out and log in again.");
        setLoading(false);
        return;
      }

      // If params.id !== me.id, redirect to their own team page with notice
      if (params.id !== me.id) {
        router.replace(`/team/${me.id}?notice=own-team`);
        return;
      }

      // Only after passing the check, load team data using the known-good id (me.id)
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("*")
        .eq("id", me.id)
        .maybeSingle();

      if (participantError) {
        // Check if it's an unauthorized/tampered access attempt
        if (participantError.code === "PGRST116" || participantError.message?.includes("coerce") || participantError.message?.includes("0 rows")) {
          setError("Nice try 😄 You can only view your own team.");
          // Don't log raw errors for unauthorized access
        } else {
          console.error("Error fetching participant:", participantError);
          setError(`Error loading team: ${participantError.message}`);
        }
        setLoading(false);
        return;
      }

      if (!participantData) {
        setError("Team not found. Please log out and log in again.");
        setLoading(false);
        return;
      }

      setParticipant(participantData);

      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from("participant_contacts")
        .select("id, email")
        .eq("participant_id", me.id)
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
          setFixtureResults({});
        } else {
          const fixtures = fixturesRes.data || [];
          setNextRoundFixtures(fixtures);
          const fixtureIds = fixtures.map((f: Fixture) => f.id);
          if (fixtureIds.length > 0) {
            const { data: resultsData } = await supabase
              .from("fixture_results_public")
              .select("fixture_id, winning_team, margin_band")
              .in("fixture_id", fixtureIds);
            const resultsMap: Record<string, FixtureResult> = {};
            (resultsData || []).forEach((r: { fixture_id: string; winning_team: string; margin_band: string | null }) => {
              resultsMap[r.fixture_id] = { winning_team: r.winning_team, margin_band: r.margin_band };
            });
            setFixtureResults(resultsMap);
          } else {
            setFixtureResults({});
          }
        }
      } else {
        setNextRoundFixtures([]);
        setFixtureResults({});
      }

      // Fetch teams for logos
      await fetchTeams();

      // Fetch picks for this participant
      await fetchPicks(me.id);
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

  const fetchPicks = async (teamId?: string) => {
    try {
      // Get the current session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        console.warn("No access token available for fetching picks");
        return;
      }

      const idToUse = teamId || participantId;
      const response = await fetch(`/api/picks?participantId=${idToUse}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
        // Convert encoded margin to margin band: 1 -> "1-12", 13 -> "13+"
        if (pick.picked_team !== "DRAW") {
          if (pick.margin === 1) marginMap[pick.fixture_id] = "1-12";
          if (pick.margin === 13) marginMap[pick.fixture_id] = "13+";
        }
      });
      
      setPicks(picksMap);
      setSelectedWinnerByFixtureId(winnerMap);
      setSelectedMarginByFixtureId(marginMap);
      // Initialize editing state: false for matches with saved picks, true for matches without
      setEditingByMatchId((prev) => {
        const next = { ...prev };
        Object.keys(picksMap).forEach((fixtureId) => {
          if (!(fixtureId in next)) {
            next[fixtureId] = false; // Has saved pick, default to locked
          }
        });
        return next;
      });
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
          setFixtureResults({});
        } else {
          const fixtures = fixturesRes.data || [];
          setNextRoundFixtures(fixtures);
          const fixtureIds = fixtures.map((f: Fixture) => f.id);
          if (fixtureIds.length > 0) {
            const { data: resultsData } = await supabase
              .from("fixture_results_public")
              .select("fixture_id, winning_team, margin_band")
              .in("fixture_id", fixtureIds);
            const resultsMap: Record<string, FixtureResult> = {};
            (resultsData || []).forEach((r: { fixture_id: string; winning_team: string; margin_band: string | null }) => {
              resultsMap[r.fixture_id] = { winning_team: r.winning_team, margin_band: r.margin_band };
            });
            setFixtureResults(resultsMap);
          } else {
            setFixtureResults({});
          }
        }
      };

      fetchRoundFixtures();
    }
  }, [selectedRoundId, hasInitialFetch]);

  const DRAW_VALUE = "DRAW";

  // Helper to format margin band for display
  const formatMarginBand = (pickedTeam: string, margin: number | null | undefined) => {
    if (pickedTeam === "DRAW") return "DRAW";
    if (margin === 13) return "13+";
    if (margin === 1) return "1–12";
    return "";
  };

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

      // Get the current session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const requestPayload = {
        participantId: participant?.id || participantId,
        fixtureId: fixture.id,
        pickedTeamCode: DRAW_VALUE,
        pickedMargin: margin,
      };

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      
      // Remove from editing mode (re-lock)
      setEditingByMatchId((prev) => ({
        ...prev,
        [fixture.id]: false,
      }));
      
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

    // Convert margin band to encoded integer: "1-12" -> 1, "13+" -> 13
    let margin = 0;
    if (marginBand === "1-12") margin = 1;
    else if (marginBand === "13+") margin = 13;

    setSavingFixtureId(fixture.id);

    // Get the current session token for authentication
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const requestPayload = {
      participantId: participant?.id || participantId,
      fixtureId: fixture.id,
      pickedTeamCode: winner,
      pickedMargin: margin,
    };

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      
      // Remove from editing mode (re-lock)
      setEditingByMatchId((prev) => ({
        ...prev,
        [fixture.id]: false,
      }));
      
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
      <div className="flex min-h-screen items-center justify-center font-sans">
        <div className="text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">
            {error || "Team not found"}
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("participant_id");
    window.location.href = "/";
  };

  const handleHome = () => {
    // Scroll to top of page (we're already on team home)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen font-sans pt-16">
      <TeamNav teamId={participant?.id || participantId} teamName={participant?.team_name || ""} onLogout={handleLogout} />

      {/* Own team notice banner */}
      {showOwnTeamNotice && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center">
          <div className="mx-auto max-w-6xl w-full px-6 sm:px-8 lg:px-12 xl:px-16">
            <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-sm text-blue-800 shadow-sm">
              You can only view your own team 🙂
            </div>
          </div>
        </div>
      )}

      <div className="py-8 pt-8">
        {/* Next Round Section */}
        <div className="mb-8">
          <div className="mb-4 flex justify-center">
            <div className="w-full max-w-2xl flex items-center justify-between">
              <div>
                {rounds.length > 0 && (
                  <Select.Root
                    value={selectedRoundId || undefined}
                    onValueChange={(value) => setSelectedRoundId(value)}
                    onOpenChange={(open) => {
                      if (open) {
                        // Scroll to top when dropdown opens
                        setTimeout(() => {
                          const viewport = document.querySelector('[data-radix-select-viewport]');
                          if (viewport) {
                            viewport.scrollTop = 0;
                          }
                        }, 0);
                      }
                    }}
                  >
                    <Select.Trigger
                      id="round-select"
                      className="cursor-pointer rounded-md border border-[#004165] bg-[#004165] px-4 py-2 text-base font-semibold text-white transition-all hover:bg-[#003554] hover:border-[#003554] focus:outline-none focus:ring-2 focus:ring-[#004165] focus:ring-offset-2 inline-flex items-center justify-between gap-2 min-w-[140px]"
                    >
                      <Select.Value placeholder="Select round" />
                      <Select.Icon className="text-white">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content
                        className="overflow-hidden rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 z-50 min-w-[var(--radix-select-trigger-width)] w-[var(--radix-select-trigger-width)]"
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        avoidCollisions={false}
                        collisionPadding={12}
                        position="popper"
                      >
                        <Select.Viewport 
                          className="p-1 max-h-[320px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-100 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600 dark:[&::-webkit-scrollbar-track]:bg-zinc-800" 
                          style={{ scrollbarGutter: 'stable', scrollbarWidth: 'thin' }}
                          data-radix-select-viewport
                        >
                          {rounds.map((round) => (
                            <Select.Item
                              key={round.id}
                              value={round.id}
                              className="relative flex items-center rounded-sm px-3 py-2 text-sm text-black outline-none cursor-pointer hover:bg-zinc-100 focus:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                            >
                              <Select.ItemText>Round {round.round_number}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedRoundId && (
                  <>
                    <Link
                      href={`/print/round/${selectedRoundId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-[#004165] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003554]"
                    >
                      <PrinterIcon className="h-4 w-4" />
                      Picks (Blank)
                    </Link>
                    <Link
                      href={`/print/round/${selectedRoundId}/team/${participant?.id || participantId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-[#004165] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#003554]"
                    >
                      <PrinterIcon className="h-4 w-4" />
                      Picks (My Picks)
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {nextRoundFixtures.length === 0 ? (
            <p className="text-center text-zinc-600 dark:text-zinc-400">
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
                const hasExistingPick = !!picks[fixture.id];
                const isEditing = editingByMatchId[fixture.id] ?? !hasExistingPick; // Default: editing if no saved pick
                const isLockedPick = hasExistingPick && !isEditing;
                const effectiveWinner = selectedWinner || existingPick?.picked_team || null;
                const isDraw = effectiveWinner === "DRAW";
                const isSaved = savedFixtureIds.has(fixture.id);
                const isSaving = savingFixtureId === fixture.id;

                return (
                  <div key={fixture.id} className="flex justify-center">
                    <div
                      className={`w-full max-w-2xl rounded-md border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 ${fixtureResults[fixture.id] ? "p-3" : "p-4"} ${isLocked ? "opacity-75" : ""}`}
                    >
                      {/* Card Header - Compact */}
                      {(() => {
                        const hasResult = !!fixtureResults[fixture.id];
                        const isCompleted = hasResult;
                        return (
                          <div className={isCompleted ? "mb-1.5 flex flex-col items-center text-center" : "mb-3 flex flex-col items-center text-center"}>
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-medium text-black dark:text-zinc-50">
                                {homeName} vs {awayName}
                              </div>
                              {hasResult ? (
                                <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  Final
                                </span>
                              ) : (
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                                    status === "open"
                                      ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-200"
                                      : status === "locked"
                                      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
                                      : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                                  }`}
                                >
                                  {status === "open" ? "Open" : status === "locked" ? "Locked" : "Not open yet"}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {kickoffStr}
                            </div>
                          </div>
                        );
                      })()}

                    {/* Error Message */}
                    {pickErrors[fixture.id] && (
                      <div className="mb-2 rounded-md bg-red-100 p-1.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-200">
                        {pickErrors[fixture.id]}
                      </div>
                    )}

                    {/* Locked Pick Display (only when locked, has pick, and no result) */}
                    {isLocked && existingPick && !fixtureResults[fixture.id] && (
                      <div className="mb-3 mx-auto w-full max-w-xl flex items-center justify-center gap-6 rounded-md border border-zinc-200 bg-zinc-50 px-6 py-3">
                        {/* Left: Logo + Pick text (no Lock/Edit) */}
                        <div className="flex items-center gap-3">
                          {existingPick.picked_team === "DRAW" ? (
                            <span className="text-2xl font-semibold text-[#004165]" aria-hidden="true">=</span>
                          ) : (
                            <>
                              {(() => {
                                const pickedTeam = teams[existingPick.picked_team || ""];
                                const pickedTeamCode = existingPick.picked_team || "";
                                return pickedTeam?.logo_path ? (
                                  <img
                                    src={getTeamLogoUrl(pickedTeam.logo_path) || `/teams/${pickedTeamCode}.svg`}
                                    alt={pickedTeam.name || TEAM_NAMES[pickedTeamCode] || pickedTeamCode}
                                    className="h-8 w-8 object-contain"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                    {pickedTeamCode}
                                  </span>
                                );
                              })()}
                            </>
                          )}
                          <span className="font-semibold text-[#004165]">
                            {existingPick.picked_team === "DRAW" ? (
                              "Draw"
                            ) : (
                              <>
                                {teams[existingPick.picked_team || ""]?.name || TEAM_NAMES[existingPick.picked_team || ""] || existingPick.picked_team || ""}
                                {existingPick.picked_team !== "DRAW" && (
                                  <> {formatMarginBand(existingPick.picked_team, existingPick.margin)}</>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Final Game Pick Row (when result exists) */}
{fixtureResults[fixture.id] && (() => {
  const res = fixtureResults[fixture.id];

  const winLabel =
    res.winning_team === "DRAW"
      ? "Draw"
      : (teams[res.winning_team]?.name ||
          TEAM_NAMES[res.winning_team] ||
          res.winning_team);

  const marginStr = res.margin_band ? ` ${res.margin_band}` : "";

  const points = !existingPick
    ? 0
    : calculatePickScore(existingPick.picked_team, existingPick.margin, {
        winning_team: res.winning_team,
        margin_band: res.margin_band,
      }).totalPoints;

  const pickedTeamCode = existingPick?.picked_team || "";
  const pickedTeam = pickedTeamCode ? teams[pickedTeamCode] : null;

  return (
    <div className="mb-3 mx-auto w-full max-w-xl grid grid-cols-[1fr_auto] items-center gap-6 rounded-md border border-zinc-200 bg-zinc-50 px-6 py-3">
      {/* Left: Pick + Final result */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Pick logo / draw indicator */}
        {existingPick ? (
          existingPick.picked_team === "DRAW" ? (
            <span className="text-2xl font-semibold text-[#004165]" aria-hidden="true">
              =
            </span>
          ) : pickedTeam?.logo_path ? (
            <img
              src={getTeamLogoUrl(pickedTeam.logo_path) || `/teams/${pickedTeamCode}.svg`}
              alt={pickedTeam.name || TEAM_NAMES[pickedTeamCode] || pickedTeamCode}
              className="h-8 w-8 flex-shrink-0 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          ) : (
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {pickedTeamCode}
            </span>
          )
        ) : null}

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[#004165]">
            {!existingPick ? (
              "No pick"
            ) : existingPick.picked_team === "DRAW" ? (
              "Draw"
            ) : (
              <>
                {teams[pickedTeamCode]?.name || TEAM_NAMES[pickedTeamCode] || pickedTeamCode}
                {pickedTeamCode !== "DRAW" && (
                  <> {formatMarginBand(existingPick.picked_team, existingPick.margin)}</>
                )}
              </>
            )}
          </div>

          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Final result: {winLabel}
            {marginStr}
          </div>
        </div>
      </div>

      {/* Right: Points badge */}
      <div className="w-14 flex flex-col items-center justify-center rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-800/50">
        <span className="text-lg font-bold leading-none text-zinc-900 dark:text-zinc-100">
          {points}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          PTS
        </span>
      </div>
    </div>
  );
})()}

                    {/* Locked Summary View */}
                    {!isLocked && isLockedPick && !fixtureResults[fixture.id] && (
                      <div className="mb-3 mx-auto w-full max-w-xl flex items-center justify-center gap-6 rounded-md border border-zinc-200 bg-zinc-50 px-6 py-3">
                        {/* Left: Logo + Summary Text Grouped */}
                        <div className="flex items-center gap-3">
                          {existingPick?.picked_team === "DRAW" ? (
                            <span className="text-2xl font-semibold text-[#004165]" aria-hidden="true">=</span>
                          ) : (
                            <>
                              {(() => {
                                const pickedTeam = teams[existingPick?.picked_team || ""];
                                const pickedTeamCode = existingPick?.picked_team || "";
                                return pickedTeam?.logo_path ? (
                                  <img
                                    src={getTeamLogoUrl(pickedTeam.logo_path) || `/teams/${pickedTeamCode}.svg`}
                                    alt={pickedTeam.name || TEAM_NAMES[pickedTeamCode] || pickedTeamCode}
                                    className="h-8 w-8 object-contain"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                                    {pickedTeamCode}
                                  </span>
                                );
                              })()}
                            </>
                          )}
                          <span className="font-semibold text-[#004165]">
                            {existingPick?.picked_team === "DRAW" ? (
                              "Draw"
                            ) : (
                              <>
                                {teams[existingPick?.picked_team || ""]?.name || TEAM_NAMES[existingPick?.picked_team || ""] || existingPick?.picked_team || ""}
                                {existingPick?.picked_team !== "DRAW" && (
                                  <> {formatMarginBand(existingPick.picked_team, existingPick.margin)}</>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                        {/* Right: Lock Icon + Edit Button */}
                        <div className="flex items-center gap-3">
                          <LockClosedIcon className="h-5 w-5 text-[#004165]" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => {
                              // Enter edit mode
                              setEditingByMatchId((prev) => ({
                                ...prev,
                                [fixture.id]: true,
                              }));
                              // Prefill selections if not already set
                              if (!selectedWinner && existingPick) {
                                setSelectedWinnerByFixtureId((prev) => ({
                                  ...prev,
                                  [fixture.id]: existingPick.picked_team,
                                }));
                              }
                              if (!selectedMargin && existingPick) {
                                // Convert margin to band
                                let marginBand = "";
                                if (existingPick.margin === 1) marginBand = "1-12";
                                else if (existingPick.margin === 13) marginBand = "13+";
                                if (marginBand) {
                                  setSelectedMarginByFixtureId((prev) => ({
                                    ...prev,
                                    [fixture.id]: marginBand,
                                  }));
                                }
                              }
                            }}
                            className="rounded-md border border-[#004165] bg-white px-3 py-1 text-sm font-medium text-[#004165] transition-colors hover:bg-blue-50"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Centered Matchup Selection Row */}
                    {!isLocked && !isLockedPick && (
                      <div className="flex items-center justify-center gap-2.5 flex-wrap mb-3">
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(fixture.id, fixture.home_team_code)}
                            disabled={isSaving || isLocked}
                            aria-label={`Pick ${homeName}`}
                            className={`relative h-24 w-24 sm:h-20 sm:w-20 flex items-center justify-center rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 p-2 ${
                              effectiveWinner === fixture.home_team_code
                                ? "border-[#004165] ring-1 ring-inset ring-[#004165] bg-blue-50 dark:bg-blue-900/30 dark:border-[#004165] dark:ring-[#004165]"
                                : "border-zinc-300 bg-white hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
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
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(fixture.id, "DRAW")}
                            disabled={isSaving || isLocked}
                            aria-label="Pick Draw"
                            className={`relative h-24 w-24 sm:h-20 sm:w-20 flex items-center justify-center rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                              effectiveWinner === "DRAW"
                                ? "border-[#004165] ring-1 ring-inset ring-[#004165] bg-blue-50 dark:bg-blue-900/30 dark:border-[#004165] dark:ring-[#004165]"
                                : "border-zinc-300 bg-white hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
                            } ${isSaving || isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            <span className="text-3xl font-semibold text-zinc-700 dark:text-zinc-300">=</span>
                          </button>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 text-center">Draw</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetWinner(fixture.id, fixture.away_team_code)}
                            disabled={isSaving || isLocked}
                            aria-label={`Pick ${awayName}`}
                            className={`relative h-24 w-24 sm:h-20 sm:w-20 flex items-center justify-center rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 p-2 ${
                              effectiveWinner === fixture.away_team_code
                                ? "border-[#004165] ring-1 ring-inset ring-[#004165] bg-blue-50 dark:bg-blue-900/30 dark:border-[#004165] dark:ring-[#004165]"
                                : "border-zinc-300 bg-white hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500"
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
                    {!isLocked && !isLockedPick && (
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <select
                          value={selectedMargin}
                          onChange={(e) => handleSetMargin(fixture.id, e.target.value)}
                          disabled={isDraw || !effectiveWinner || isSaving || isLocked}
                          className={`rounded-md border px-2.5 py-1 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 ${
                            isDraw || !effectiveWinner || isSaving || isLocked
                              ? "cursor-not-allowed opacity-50 bg-zinc-100 border-zinc-300 dark:bg-zinc-900"
                              : hasExistingPick && selectedMargin
                              ? "border-[#004165] bg-blue-50 dark:bg-blue-900/20"
                              : "border-zinc-300"
                          }`}
                        >
                          <option value="">Select margin</option>
                          <option value="1-12">1-12</option>
                          <option value="13+">13+</option>
                        </select>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                // Cancel: revert to existing pick
                                if (existingPick) {
                                  setSelectedWinnerByFixtureId((prev) => ({
                                    ...prev,
                                    [fixture.id]: existingPick.picked_team,
                                  }));
                                  // Convert margin to band
                                  let marginBand = "";
                                  if (existingPick.margin === 1) marginBand = "1-12";
                                  else if (existingPick.margin === 13) marginBand = "13+";
                                  setSelectedMarginByFixtureId((prev) => ({
                                    ...prev,
                                    [fixture.id]: marginBand,
                                  }));
                                }
                                // Exit edit mode
                                setEditingByMatchId((prev) => ({
                                  ...prev,
                                  [fixture.id]: false,
                                }));
                              }}
                              className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSavePick(fixture)}
                              disabled={isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)}
                              className={`rounded-md border px-3 py-1 text-sm text-white transition-colors ${
                                isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)
                                  ? "cursor-not-allowed opacity-50 border-zinc-400 bg-zinc-400"
                                  : "border-[#004165] bg-[#004165] hover:bg-[#003554] hover:border-[#003554]"
                              }`}
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSavePick(fixture)}
                            disabled={isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)}
                            className={`rounded-md border px-3 py-1 text-sm text-white transition-colors ${
                              isSaving || isLocked || !effectiveWinner || (effectiveWinner !== "DRAW" && !selectedMargin)
                                ? "cursor-not-allowed opacity-50 border-zinc-400 bg-zinc-400"
                                : "border-[#004165] bg-[#004165] hover:bg-[#003554] hover:border-[#003554]"
                            }`}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
