"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TrashIcon } from "@heroicons/react/24/outline";

type Round = {
  id: string;
  season: number;
  round_number: number;
  lock_time: string | null;
  league_id?: string;
};

type Team = {
  code: string;
  name: string;
  logo_path: string | null;
  sort_order: number;
};

type Fixture = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  round_id: string;
};

type Result = {
  fixture_id: string;
  winning_team: string;
  margin_band: string | null;
};

type MatchOdds = {
  fixture_id: string;
  draw_odds: number;
  home_1_12_odds: number;
  home_13_plus_odds: number;
  away_1_12_odds: number;
  away_13_plus_odds: number;
  odds_as_at: string;
  updated_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [resultEntries, setResultEntries] = useState<Record<string, { winning_team: string; margin_band: string | null }>>({});
  const [matchOdds, setMatchOdds] = useState<Record<string, MatchOdds>>({});
  const [oddsEntries, setOddsEntries] = useState<Record<string, {
    draw_odds: string;
    home_1_12_odds: string;
    home_13_plus_odds: string;
    away_1_12_odds: string;
    away_13_plus_odds: string;
  }>>({});
  const [savingOddsFixtureId, setSavingOddsFixtureId] = useState<string | null>(null);
  const [editingResultFixtureId, setEditingResultFixtureId] = useState<string | null>(null);
  const [editingOddsFixtureId, setEditingOddsFixtureId] = useState<string | null>(null);
  const [confirmModalData, setConfirmModalData] = useState<{ fixtureId: string; fixture: Fixture; entry: { winning_team: string; margin_band: string | null } } | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<{ fixtureId: string; fixture: Fixture } | null>(null);
  const [deleteRoundTarget, setDeleteRoundTarget] = useState<Round | null>(null);
  const [deleteRoundError, setDeleteRoundError] = useState<string | null>(null);
  const [deleteRoundLoading, setDeleteRoundLoading] = useState<boolean>(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<{ fixture: Fixture } | null>(null);
  const [overrideParticipantId, setOverrideParticipantId] = useState<string>("");
  const [overridePickedTeamCode, setOverridePickedTeamCode] = useState<string>("");
  const [overrideMargin, setOverrideMargin] = useState<number | null>(null);
  const [overrideConfirmText, setOverrideConfirmText] = useState<string>("");
  const [overrideParticipants, setOverrideParticipants] = useState<{ id: string; team_name: string }[]>([]);
  const [overrideLoading, setOverrideLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paperBetsParticipantId, setPaperBetsParticipantId] = useState<string>("");
  const [paperBetsRoundId, setPaperBetsRoundId] = useState<string>("");
  const [paperBetsConfirmText, setPaperBetsConfirmText] = useState<string>("");
  const [paperBetsParticipants, setPaperBetsParticipants] = useState<{ id: string; team_name: string }[]>([]);
  const [paperBetsLoading, setPaperBetsLoading] = useState<boolean>(false);
  const [analyticsSummary, setAnalyticsSummary] = useState<{
    landing_view: number;
    login_success: number;
    register_success: number;
    pick_saved: number;
    total_participants: number;
  } | null>(null);

  // Round form state
  const [roundSeason, setRoundSeason] = useState<number>(new Date().getFullYear());
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // Fixture form state
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [fixtureMatchNumber, setFixtureMatchNumber] = useState<number>(1);
  const [fixtureHomeTeamCode, setFixtureHomeTeamCode] = useState<string>("");
  const [fixtureAwayTeamCode, setFixtureAwayTeamCode] = useState<string>("");
  const [fixtureKickoffAt, setFixtureKickoffAt] = useState<string>("");

  // Fetch functions (hoisted as function declarations)
  async function fetchRounds() {
    try {
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .order("season", { ascending: true })
        .order("round_number", { ascending: true });

      if (error) {
        console.error("Error fetching rounds:", error);
        setMessage({ type: "error", text: `Error fetching rounds: ${error.message}` });
      } else {
        setRounds(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching rounds:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }

  async function fetchTeams() {
    const TEAMS_TABLE = "super_rugby_teams";
    try {
      const { data, error } = await supabase
        .from(TEAMS_TABLE)
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error fetching teams:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          raw: error
        });
        setMessage({ type: "error", text: `Error fetching teams: ${error?.message ?? JSON.stringify(error)}` });
      } else {
        setTeams(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching teams:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }

  async function fetchFixtures(roundId: string) {
    try {
      const { data, error } = await supabase
        .from("fixtures")
        .select("id, match_number, home_team_code, away_team_code, kickoff_at, round_id")
        .eq("round_id", roundId)
        .order("match_number", { ascending: true });

      if (error) {
        console.error("Error fetching fixtures:", error);
        setMessage({ type: "error", text: `Error fetching fixtures: ${error.message}` });
      } else {
        setFixtures(data || []);
        if (data && data.length > 0) {
          const fixtureIds = data.map((f) => f.id);
          fetchResults(fixtureIds);
          fetchMatchOdds(fixtureIds);
        } else {
          setResults({});
          setResultEntries({});
          setMatchOdds({});
          setOddsEntries({});
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching fixtures:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }

  async function fetchResults(fixtureIds: string[]) {
    try {
      const { data, error } = await supabase
        .from("results")
        .select("fixture_id, winning_team, margin_band")
        .in("fixture_id", fixtureIds);

      if (error) {
        console.error("Error fetching results:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        setMessage({ type: "error", text: `Error fetching results: ${error.message}` });
      } else {
        const resultsMap: Record<string, Result> = {};
        const entriesMap: Record<string, { winning_team: string; margin_band: string | null }> = {};
        (data || []).forEach((result) => {
          resultsMap[result.fixture_id] = result;
          entriesMap[result.fixture_id] = {
            winning_team: result.winning_team,
            margin_band: result.margin_band,
          };
        });
        // Initialize entries for fixtures without results
        fixtureIds.forEach((fixtureId) => {
          if (!entriesMap[fixtureId]) {
            entriesMap[fixtureId] = {
              winning_team: "",
              margin_band: null,
            };
          }
        });
        setResults(resultsMap);
        setResultEntries(entriesMap);
      }
    } catch (err) {
      console.error("Unexpected error fetching results:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  }

  async function fetchMatchOdds(fixtureIds: string[]) {
    try {
      if (fixtureIds.length === 0) {
        setMatchOdds({});
        setOddsEntries({});
        return;
      }

      const { data, error } = await supabase
        .from("match_odds")
        .select("*")
        .in("fixture_id", fixtureIds);

      if (error) {
        console.error("Error fetching match odds:", error);
        // Don't show error message for odds, just log it
      } else {
        const oddsMap: Record<string, MatchOdds> = {};
        const entriesMap: Record<string, {
          draw_odds: string;
          home_1_12_odds: string;
          home_13_plus_odds: string;
          away_1_12_odds: string;
          away_13_plus_odds: string;
        }> = {};
        (data || []).forEach((odds) => {
          oddsMap[odds.fixture_id] = odds;
          entriesMap[odds.fixture_id] = {
            draw_odds: odds.draw_odds.toString(),
            home_1_12_odds: odds.home_1_12_odds.toString(),
            home_13_plus_odds: odds.home_13_plus_odds.toString(),
            away_1_12_odds: odds.away_1_12_odds.toString(),
            away_13_plus_odds: odds.away_13_plus_odds.toString(),
          };
        });
        // Initialize entries for fixtures without odds
        fixtureIds.forEach((fixtureId) => {
          if (!entriesMap[fixtureId]) {
            entriesMap[fixtureId] = {
              draw_odds: "",
              home_1_12_odds: "",
              home_13_plus_odds: "",
              away_1_12_odds: "",
              away_13_plus_odds: "",
            };
          }
        });
        setMatchOdds(oddsMap);
        setOddsEntries(entriesMap);
      }
    } catch (err) {
      console.error("Unexpected error fetching match odds:", err);
    }
  }

  // Admin gate: check authentication and admin email on load
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      // Debug: log signed-in email
      console.log("[Admin Debug] Signed-in email:", user.email);

      // Check admin email allowlist (case-insensitive)
      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      console.log("[Admin Debug] NEXT_PUBLIC_ADMIN_EMAILS env string:", envString);
      
      const adminEmails = envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const userIsAdmin = adminEmails.length > 0 && userEmailLower && adminEmails.includes(userEmailLower);
      console.log("[Admin Debug] isAdmin (client-side check):", userIsAdmin);
      
      if (!userIsAdmin) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      // User is authenticated and verified as admin
      setIsAdmin(true);
      setAuthChecked(true);
      
      // Only fetch admin data after admin check passes
      fetchRounds();
      fetchTeams();
      fetchAnalyticsSummary();
    };

    checkAdmin();
  }, [router]);

  // Fetch analytics summary
  async function fetchAnalyticsSummary() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/analytics-summary", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyticsSummary(data);
      } else {
        console.error("Error fetching analytics summary");
      }
    } catch (err) {
      console.error("Unexpected error fetching analytics summary:", err);
    }
  }

  // Fetch fixtures when round is selected (only if admin)
  useEffect(() => {
    if (!isAdmin) return;
    
    if (selectedRoundId) {
      (async () => {
        await fetchFixtures(selectedRoundId);
      })();
    } else {
      // Reset form state when no round is selected
      setFixtures([]);
      setResults({});
      setResultEntries({});
      setMatchOdds({});
      setOddsEntries({});
      setEditingResultFixtureId(null);
      setEditingFixtureId(null);
      setFixtureMatchNumber(1);
      setFixtureHomeTeamCode("");
      setFixtureAwayTeamCode("");
      setFixtureKickoffAt("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoundId, isAdmin]);

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      // Get session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          season: roundSeason,
          round_number: roundNumber,
        }),
      });

      // Handle 409 (duplicate round) with friendly message
      if (response.status === 409) {
        setMessage({ type: "error", text: "Round already exists. Select it from the list." });
        return;
      }

      // Handle 401/403 with clear message
      if (response.status === 401 || response.status === 403) {
        setMessage({ type: "error", text: "Not authorized" });
        console.error("Error creating round: Not authorized (status", response.status);
        return;
      }

      // Read response body safely
      const contentType = response.headers.get("content-type");
      let result: { error?: string; data?: unknown } | null = null;
      let responseText: string | null = null;

      if (contentType?.includes("application/json")) {
        try {
          result = await response.json();
        } catch (jsonError) {
          // If JSON parsing fails, read as text
          responseText = await response.text().catch(() => null);
        }
      } else {
        // Not JSON, read as text
        responseText = await response.text().catch(() => null);
      }

      if (!response.ok) {
        // Extract error message in priority order
        let errorMsg: string;
        if (result?.error) {
          errorMsg = result.error;
        } else if (responseText) {
          errorMsg = responseText;
        } else {
          errorMsg = response.statusText || "Failed to create round";
        }

        // Log meaningful error (never {})
        const logData = result && typeof result === "object" && Object.keys(result).length > 0 
          ? result 
          : errorMsg;
        console.error("Error creating round:", logData);

        setMessage({ type: "error", text: `Error: ${errorMsg}` });
      } else {
        console.log("Round created:", result?.data || result);
        setMessage({ type: "success", text: "Round created successfully!" });
        setRoundNumber(roundNumber + 1);
        fetchRounds();
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const resetFixtureForm = () => {
    setEditingFixtureId(null);
    setFixtureMatchNumber(1);
    setFixtureHomeTeamCode("");
    setFixtureAwayTeamCode("");
    setFixtureKickoffAt("");
  };

  const handleCreateFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedRoundId) {
      setMessage({ type: "error", text: "Please select a round first" });
      return;
    }

    if (fixtureHomeTeamCode === fixtureAwayTeamCode) {
      setMessage({ type: "error", text: "Home and away team cannot be the same" });
      return;
    }

    try {
      const kickoffAtIso = fixtureKickoffAt
        ? new Date(fixtureKickoffAt).toISOString()
        : null;

      const fixtureData: {
        round_id: string;
        match_number: number;
        home_team_code: string;
        away_team_code: string;
        kickoff_at: string | null;
      } = {
        round_id: selectedRoundId,
        match_number: fixtureMatchNumber,
        home_team_code: fixtureHomeTeamCode,
        away_team_code: fixtureAwayTeamCode,
        kickoff_at: kickoffAtIso,
      };

      // Get session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: editingFixtureId || undefined,
          round_id: selectedRoundId,
          match_number: fixtureMatchNumber,
          home_team_code: fixtureHomeTeamCode,
          away_team_code: fixtureAwayTeamCode,
          kickoff_at: kickoffAtIso,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error saving fixture:", result);
        setMessage({ type: "error", text: `Error: ${result.error || "Failed to save fixture"}` });
      } else {
        console.log("Fixture saved:", result.data);
        setMessage({ type: "success", text: editingFixtureId ? "Fixture updated successfully!" : "Fixture created successfully!" });
        if (editingFixtureId) {
          resetFixtureForm();
        } else {
          setFixtureMatchNumber(fixtureMatchNumber + 1);
          setFixtureHomeTeamCode("");
          setFixtureAwayTeamCode("");
          setFixtureKickoffAt("");
        }
        fetchFixtures(selectedRoundId);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const handleEditFixture = (fixture: Fixture) => {
    setEditingFixtureId(fixture.id);
    setFixtureMatchNumber(fixture.match_number);
    setFixtureHomeTeamCode(fixture.home_team_code);
    setFixtureAwayTeamCode(fixture.away_team_code);
    if (fixture.kickoff_at) {
      const kickoffValue = new Date(fixture.kickoff_at)
        .toLocaleString("sv-SE", { timeZone: "Pacific/Auckland" })
        .replace(" ", "T")
        .slice(0, 16);
      setFixtureKickoffAt(kickoffValue);
    } else {
      setFixtureKickoffAt("");
    }
  };

  const handleDeleteFixture = async (fixtureId: string) => {
    if (!confirm("Are you sure you want to delete this fixture?")) {
      return;
    }

    setMessage(null);

    try {
      // Get session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/admin/fixtures?id=${fixtureId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error deleting fixture:", result);
        setMessage({ type: "error", text: `Error: ${result.error || "Failed to delete fixture"}` });
      } else {
        console.log("Fixture deleted");
        setMessage({ type: "success", text: "Fixture deleted successfully!" });
        if (selectedRoundId) {
          fetchFixtures(selectedRoundId);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const selectedRound = rounds.find((r) => r.id === selectedRoundId);

  const getTeamName = (code: string) => {
    const team = teams.find((t) => t.code === code);
    return team ? team.name : code;
  };

  const getTeam = (code: string) => {
    return teams.find((t) => t.code === code);
  };

  const handleSetWinner = (fixtureId: string, winner: string) => {
    setResultEntries((prev) => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        winning_team: winner,
        margin_band: winner === "DRAW" ? null : prev[fixtureId]?.margin_band ?? null,
      },
    }));
  };

  const handleSetMargin = (fixtureId: string, marginBand: string | null) => {
    setResultEntries((prev) => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        margin_band: marginBand,
      },
    }));
  };

  const handleSaveResult = (fixtureId: string) => {
    const entry = resultEntries[fixtureId];
    if (!entry || !entry.winning_team) {
      setMessage({ type: "error", text: "Please select a winner" });
      return;
    }

    if (entry.winning_team !== "DRAW" && !entry.margin_band) {
      setMessage({ type: "error", text: "Please select a margin" });
      return;
    }

    const fixture = fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;

    setConfirmModalData({ fixtureId, fixture, entry });
  };

  const handleConfirmSaveResult = async () => {
    if (!confirmModalData) return;

    const { fixtureId, entry } = confirmModalData;
    setMessage(null);
    setConfirmModalData(null);

    try {
      // Get session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fixture_id: fixtureId,
          winning_team: entry.winning_team,
          margin_band: entry.winning_team === "DRAW" ? null : entry.margin_band,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error saving result:", result);
        setMessage({ type: "error", text: `Error: ${result.error || "Failed to save result"}` });
      } else {
        console.log("Result saved:", result.data);
        setMessage({ type: "success", text: "Result saved successfully!" });
        setEditingResultFixtureId(null);
        if (selectedRoundId) {
          fetchFixtures(selectedRoundId);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const handleCancelEditResult = (fixtureId: string) => {
    const existingResult = results[fixtureId];
    setResultEntries((prev) => ({
      ...prev,
      [fixtureId]: {
        winning_team: existingResult?.winning_team || "",
        margin_band: existingResult?.margin_band ?? null,
      },
    }));
    setEditingResultFixtureId(null);
  };

  const formatOdds = (n: number | string | null | undefined): string => {
    const num = Number(n);
    if (isNaN(num) || num <= 0) return "—";
    return "$" + num.toFixed(2);
  };

  const handleSetOdds = (fixtureId: string, field: string, value: string) => {
    setOddsEntries((prev) => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        [field]: value,
      },
    }));
  };

  const handleEditOdds = (fixtureId: string) => {
    const savedOdds = matchOdds[fixtureId];
    if (savedOdds) {
      setOddsEntries((prev) => ({
        ...prev,
        [fixtureId]: {
          draw_odds: savedOdds.draw_odds.toString(),
          home_1_12_odds: savedOdds.home_1_12_odds.toString(),
          home_13_plus_odds: savedOdds.home_13_plus_odds.toString(),
          away_1_12_odds: savedOdds.away_1_12_odds.toString(),
          away_13_plus_odds: savedOdds.away_13_plus_odds.toString(),
        },
      }));
    }
    setEditingOddsFixtureId(fixtureId);
  };

  const handleCancelEditOdds = (fixtureId: string) => {
    const savedOdds = matchOdds[fixtureId];
    if (savedOdds) {
      setOddsEntries((prev) => ({
        ...prev,
        [fixtureId]: {
          draw_odds: savedOdds.draw_odds.toString(),
          home_1_12_odds: savedOdds.home_1_12_odds.toString(),
          home_13_plus_odds: savedOdds.home_13_plus_odds.toString(),
          away_1_12_odds: savedOdds.away_1_12_odds.toString(),
          away_13_plus_odds: savedOdds.away_13_plus_odds.toString(),
        },
      }));
    } else {
      setOddsEntries((prev) => ({
        ...prev,
        [fixtureId]: {
          draw_odds: "",
          home_1_12_odds: "",
          home_13_plus_odds: "",
          away_1_12_odds: "",
          away_13_plus_odds: "",
        },
      }));
    }
    setEditingOddsFixtureId(null);
  };

  const handleSaveOdds = async (fixtureId: string) => {
    const entry = oddsEntries[fixtureId];
    if (!entry) return;

    // Validate all fields are present and >= 1.01
    const odds = [
      { key: "draw_odds", value: entry.draw_odds },
      { key: "home_1_12_odds", value: entry.home_1_12_odds },
      { key: "home_13_plus_odds", value: entry.home_13_plus_odds },
      { key: "away_1_12_odds", value: entry.away_1_12_odds },
      { key: "away_13_plus_odds", value: entry.away_13_plus_odds },
    ];

    for (const { key, value } of odds) {
      if (!value || value.trim() === "") {
        setMessage({ type: "error", text: `Please enter all odds values` });
        return;
      }
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 1.01) {
        setMessage({ type: "error", text: `All odds must be >= 1.01` });
        return;
      }
    }

    setSavingOddsFixtureId(fixtureId);
    setMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/odds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fixture_id: fixtureId,
          draw_odds: parseFloat(entry.draw_odds),
          home_1_12_odds: parseFloat(entry.home_1_12_odds),
          home_13_plus_odds: parseFloat(entry.home_13_plus_odds),
          away_1_12_odds: parseFloat(entry.away_1_12_odds),
          away_13_plus_odds: parseFloat(entry.away_13_plus_odds),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error saving odds:", result);
        setMessage({ type: "error", text: `Error: ${result.error || "Failed to save odds"}` });
      } else {
        console.log("Odds saved:", result.data);
        setMessage({ type: "success", text: "Odds saved successfully!" });
        setEditingOddsFixtureId(null);
        // Refresh odds
        if (selectedRoundId) {
          fetchFixtures(selectedRoundId);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally {
      setSavingOddsFixtureId(null);
    }
  };

  const handleDeleteResult = (fixtureId: string) => {
    const fixture = fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return;
    setDeleteModalData({ fixtureId, fixture });
  };

  const handleConfirmDeleteResult = async () => {
    if (!deleteModalData) return;

    const { fixtureId } = deleteModalData;
    setMessage(null);
    setDeleteModalData(null);

    try {
      // Get session token for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/admin/results?fixtureId=${fixtureId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Error deleting result:", result);
        setMessage({ type: "error", text: `Error: ${result.error || "Failed to delete result"}` });
      } else {
        console.log("Result deleted");
        setMessage({ type: "success", text: "Result deleted" });
        // Clear local state for this fixture
        setResultEntries((prev) => ({
          ...prev,
          [fixtureId]: {
            winning_team: "",
            margin_band: null,
          },
        }));
        setEditingResultFixtureId(null);
        // Re-fetch results to update the UI
        if (selectedRoundId) {
          fetchFixtures(selectedRoundId);
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const closeDeleteRoundModal = () => {
    setDeleteRoundTarget(null);
    setDeleteRoundError(null);
  };

  // Fetch participants for override when modal opens (via admin API to bypass RLS)
  useEffect(() => {
    if (!overrideTarget || !selectedRoundId) return;
    const round = rounds.find((r) => r.id === selectedRoundId);
    const leagueId = round?.league_id ?? "";
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const url = new URL("/api/admin/participants", window.location.origin);
        if (leagueId) url.searchParams.set("leagueId", leagueId);
        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok) {
          console.error("Error fetching participants for override:", json.error);
          setOverrideParticipants([]);
          return;
        }
        const rows = Array.isArray(json?.data) ? json.data : [];
        setOverrideParticipants(rows.map((p: { id: string; team_name?: string | null }) => ({ id: p.id, team_name: p.team_name ?? "" })));
        console.log("[Override] participants loaded:", rows.length);
      } catch (err) {
        console.error("Error fetching participants for override:", err);
        setOverrideParticipants([]);
      }
    })();
  }, [overrideTarget, selectedRoundId, rounds]);

  // Fetch participants for Paper Bets Tools (by round league or all)
  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const url = new URL("/api/admin/participants", window.location.origin);
        if (paperBetsRoundId) {
          const round = rounds.find((r) => r.id === paperBetsRoundId);
          if (round?.league_id) url.searchParams.set("leagueId", round.league_id);
        }
        const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (!res.ok) {
          setPaperBetsParticipants([]);
          return;
        }
        const rows = Array.isArray(json?.data) ? json.data : [];
        setPaperBetsParticipants(rows.map((p: { id: string; team_name?: string | null }) => ({ id: p.id, team_name: p.team_name ?? "" })));
      } catch {
        setPaperBetsParticipants([]);
      }
    })();
  }, [paperBetsRoundId, rounds]);

  const handleSyncPaperBetsTool = async () => {
    if (paperBetsConfirmText !== "OVERRIDE" || !paperBetsParticipantId) return;
    setPaperBetsLoading(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/admin/sync-paper-bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          participant_id: paperBetsParticipantId,
          round_id: paperBetsRoundId || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Sync failed" });
      } else {
        const upsertedCount = result.upsertedCount ?? 0;
        const skipped = Array.isArray(result.skippedFixtureIds) ? result.skippedFixtureIds.length : 0;
        setMessage({
          type: "success",
          text: `Sync paper bets: ${upsertedCount} upserted, ${skipped} skipped (no odds).`,
        });
      }
    } catch (err) {
      console.error("Sync paper bets error:", err);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setPaperBetsLoading(false);
    }
  };

  const openOverrideModal = (fixture: Fixture) => {
    setOverrideTarget({ fixture });
    setOverrideParticipantId("");
    setOverridePickedTeamCode("");
    setOverrideMargin(null);
    setOverrideConfirmText("");
  };

  const closeOverrideModal = () => {
    setOverrideTarget(null);
    setOverrideParticipantId("");
    setOverridePickedTeamCode("");
    setOverrideMargin(null);
    setOverrideConfirmText("");
  };

  const handleOverrideSubmit = async (action: "upsert" | "delete") => {
    if (!overrideTarget || overrideConfirmText !== "OVERRIDE") return;
    const { fixture } = overrideTarget;
    if (action === "upsert" && (overridePickedTeamCode === "" || overrideMargin === undefined)) return;
    if (!overrideParticipantId && action === "upsert") return;

    setOverrideLoading(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const body: Record<string, unknown> = {
        participant_id: overrideParticipantId,
        fixture_id: fixture.id,
        action,
      };
      if (action === "upsert") {
        body.picked_team_code = overridePickedTeamCode;
        body.margin = overridePickedTeamCode === "DRAW" ? 0 : overrideMargin;
      }

      const response = await fetch("/api/admin/override-pick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Override failed" });
        setOverrideLoading(false);
        return;
      }
      setMessage({ type: "success", text: action === "delete" ? "Pick deleted." : "Pick overridden." });
      closeOverrideModal();
      if (selectedRoundId) fetchFixtures(selectedRoundId);
    } catch (err) {
      console.error("Override error:", err);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Override failed" });
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleBackfillPaperBets = async () => {
    if (overrideConfirmText !== "OVERRIDE" || !overrideParticipantId) return;
    setOverrideLoading(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/admin/backfill-paperbets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          participant_id: overrideParticipantId,
          round_id: selectedRoundId ?? undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Backfill failed" });
      } else {
        const { processed = 0, upserted = 0, skipped = 0 } = result;
        setMessage({
          type: "success",
          text: `Backfill: processed ${processed}, upserted ${upserted}, skipped ${skipped}.`,
        });
      }
    } catch (err) {
      console.error("Backfill error:", err);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Backfill failed" });
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleConfirmDeleteRound = async () => {
    if (!deleteRoundTarget) return;

    setDeleteRoundError(null);
    setDeleteRoundLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/admin/rounds?roundId=${deleteRoundTarget.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await response.json();

      if (response.status === 400) {
        setDeleteRoundError(result.error || "Cannot delete a round that has fixtures. Delete fixtures first.");
        setDeleteRoundLoading(false);
        return;
      }

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "Failed to delete round" });
        closeDeleteRoundModal();
        setDeleteRoundLoading(false);
        return;
      }

      setMessage({ type: "success", text: "Round deleted." });
      if (selectedRoundId === deleteRoundTarget.id) {
        setSelectedRoundId(null);
      }
      closeDeleteRoundModal();
      setDeleteRoundLoading(false);
      fetchRounds();
    } catch (err) {
      console.error("Unexpected error deleting round:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
      closeDeleteRoundModal();
      setDeleteRoundLoading(false);
    }
  };

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
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Admin - Rounds & Fixtures
        </h1>
      </div>

        {message && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === "success" 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}>
            {message.text}
          </div>
        )}

        {/* Analytics Summary */}
        {analyticsSummary && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-lg font-semibold text-black dark:text-zinc-50">Analytics (Last 7 Days)</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Landing Views:</span>{" "}
                <span className="font-medium text-black dark:text-zinc-50">{analyticsSummary.landing_view}</span>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Login Success:</span>{" "}
                <span className="font-medium text-black dark:text-zinc-50">{analyticsSummary.login_success}</span>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Register Success:</span>{" "}
                <span className="font-medium text-black dark:text-zinc-50">{analyticsSummary.register_success}</span>
              </div>
              <div>
                <span className="text-zinc-600 dark:text-zinc-400">Picks Saved:</span>{" "}
                <span className="font-medium text-black dark:text-zinc-50">{analyticsSummary.pick_saved}</span>
              </div>
            </div>
            <div className="mt-3 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Total Participants:</span>{" "}
              <span className="font-medium text-black dark:text-zinc-50">{analyticsSummary.total_participants}</span>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Round Creation Form */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Create Round</h2>
            <form onSubmit={handleCreateRound} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Season
                </label>
                <input
                  type="number"
                  value={roundSeason}
                  onChange={(e) => setRoundSeason(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Round Number
                </label>
                <input
                  type="number"
                  value={roundNumber}
                  onChange={(e) => setRoundNumber(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Create Round
              </button>
            </form>
          </div>

          {/* Rounds List */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Rounds</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rounds.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No rounds yet</p>
              ) : (
                rounds.map((round) => (
                  <div
                    key={round.id}
                    className={`flex items-center justify-between rounded-md border p-3 ${
                      selectedRoundId === round.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <a
                        href={`/print/round/${round.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                        title="Print picks sheet"
                      >
                        🖨️
                      </a>
                      <span className="text-sm font-medium text-black dark:text-zinc-50">
                        Season {round.season} - Round {round.round_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedRoundId(round.id)}
                        className={`rounded-md px-3 py-1 text-xs transition-colors ${
                          selectedRoundId === round.id
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                        }`}
                      >
                        {selectedRoundId === round.id ? "Selected" : "Select"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteRoundTarget(round); setDeleteRoundError(null); }}
                        disabled={deleteRoundLoading && deleteRoundTarget?.id === round.id}
                        className="rounded-md p-1.5 text-zinc-600 hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-600 dark:disabled:hover:bg-transparent dark:disabled:hover:text-zinc-400"
                        title="Delete round"
                        aria-label="Delete round"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Paper Bets Tools */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">Paper Bets Tools</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Round</label>
              <select
                value={paperBetsRoundId}
                onChange={(e) => setPaperBetsRoundId(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">All rounds</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    Season {r.season} – Round {r.round_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Participant</label>
              <select
                value={paperBetsParticipantId}
                onChange={(e) => setPaperBetsParticipantId(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 min-w-[180px]"
              >
                <option value="">Select participant</option>
                {paperBetsParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.team_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Type OVERRIDE to confirm</label>
              <input
                type="text"
                value={paperBetsConfirmText}
                onChange={(e) => setPaperBetsConfirmText(e.target.value)}
                placeholder="OVERRIDE"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 w-40"
              />
            </div>
            <button
              type="button"
              onClick={handleSyncPaperBetsTool}
              disabled={paperBetsConfirmText !== "OVERRIDE" || !paperBetsParticipantId || paperBetsLoading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paperBetsLoading ? "Syncing…" : "Sync paper bets"}
            </button>
          </div>
        </div>

        {/* Fixture Creation Form - Only show when round is selected */}
        {selectedRoundId && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
              {editingFixtureId ? "Edit" : "Create"} Fixture {selectedRound && `(Season ${selectedRound.season} - Round ${selectedRound.round_number})`}
            </h2>
            <form onSubmit={handleCreateFixture} className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Match Number
                </label>
                <input
                  type="number"
                  value={fixtureMatchNumber}
                  onChange={(e) => setFixtureMatchNumber(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Kickoff At
                </label>
                <input
                  type="datetime-local"
                  value={fixtureKickoffAt}
                  onChange={(e) => setFixtureKickoffAt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Home Team
                </label>
                <select
                  value={fixtureHomeTeamCode}
                  onChange={(e) => setFixtureHomeTeamCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  required
                >
                  <option value="">Select home team</option>
                  {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Away Team
                </label>
                <select
                  value={fixtureAwayTeamCode}
                  onChange={(e) => setFixtureAwayTeamCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  required
                >
                  <option value="">Select away team</option>
                  {[...teams].sort((a, b) => a.name.localeCompare(b.name)).map((team) => (
                    <option key={team.code} value={team.code}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  {editingFixtureId ? "Update Fixture" : "Create Fixture"}
                </button>
                {editingFixtureId && (
                  <button
                    type="button"
                    onClick={resetFixtureForm}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Fixtures List - Only show when round is selected */}
        {selectedRoundId && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-zinc-50">
              Fixtures {selectedRound && `(Season ${selectedRound.season} - Round ${selectedRound.round_number})`}
            </h2>
            {fixtures.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No fixtures yet for this round</p>
            ) : (
              <div className="space-y-4">
                {fixtures.map((fixture) => {
                  const homeTeam = getTeam(fixture.home_team_code);
                  const awayTeam = getTeam(fixture.away_team_code);
                  const homeName = homeTeam ? homeTeam.name : fixture.home_team_code;
                  const awayName = awayTeam ? awayTeam.name : fixture.away_team_code;
                  const kickoffStr = fixture.kickoff_at
                    ? new Intl.DateTimeFormat("en-NZ", {
                        timeZone: "Pacific/Auckland",
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      }).format(new Date(fixture.kickoff_at))
                    : "(no kickoff time)";
                  const existingResult = results[fixture.id];
                  const entry = resultEntries[fixture.id] || {
                    winning_team: existingResult?.winning_team || "",
                    margin_band: existingResult?.margin_band ?? null,
                  };
                  // Strict boolean definitions at source
                  const isSaved = Boolean(existingResult);
                  const isEditing = editingResultFixtureId === fixture.id;
                  const isDraw = Boolean(entry.winning_team === "DRAW");
                  const isLocked = isSaved && !isEditing;
                  
                  // Determine kickoff status for warnings (no lockout)
                  const kickoffTime = fixture.kickoff_at ? new Date(fixture.kickoff_at) : null;
                  const now = new Date();
                  const isKickoffInFuture = kickoffTime ? now < kickoffTime : false;
                  const isKickoffNull = !fixture.kickoff_at;
                  
                  // Use strict booleans directly (no need for separate Bool variables)
                  const isDrawBool = isDraw;
                  const isSavedBool = isSaved;
                  return (
                    <div
                      key={fixture.id}
                      className={`rounded-lg border-2 bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                        isSaved
                          ? "border-l-8 border-l-green-500 border-r border-t border-b border-zinc-200 dark:border-r-zinc-700 dark:border-t-zinc-700 dark:border-b-zinc-700"
                          : "border-l-8 border-l-zinc-300 border-r border-t border-b border-zinc-200 dark:border-l-zinc-700 dark:border-r-zinc-700 dark:border-t-zinc-700 dark:border-b-zinc-700"
                      }`}
                    >
                      {/* Header: Match info + Edit/Delete buttons */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-base font-semibold text-black dark:text-zinc-50">
                            <span>Match {fixture.match_number}:</span>
                            <div className="flex items-center gap-1">
                              {homeTeam?.logo_path && (
                                <img
                                  src={homeTeam.logo_path}
                                  alt={homeName}
                                  className="h-5 w-5 object-contain"
                                />
                              )}
                              <span>{homeName}</span>
                            </div>
                            <span>vs</span>
                            <div className="flex items-center gap-1">
                              {awayTeam?.logo_path && (
                                <img
                                  src={awayTeam.logo_path}
                                  alt={awayName}
                                  className="h-5 w-5 object-contain"
                                />
                              )}
                              <span>{awayName}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!existingResult && (isKickoffNull || isKickoffInFuture) && (
                              <button
                                type="button"
                                onClick={() => openOverrideModal(fixture)}
                                className="rounded-md border border-amber-500 px-3 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
                              >
                                Override pick
                              </button>
                            )}
                            <button
                              onClick={() => handleEditFixture(fixture)}
                              className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFixture(fixture.id)}
                              className="rounded-md bg-red-600 px-3 py-1 text-xs text-white transition-colors hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {kickoffStr}
                        </div>
                      </div>

                      {/* Body: Result and Odds panels */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Result Panel */}
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 dark:bg-zinc-950 dark:border-zinc-800">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              Result
                            </div>
                            <div className="flex items-center gap-2">
                              {isKickoffNull && (
                                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  No kickoff time
                                </span>
                              )}
                              {!isKickoffNull && isKickoffInFuture && (
                                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Future kickoff
                                </span>
                              )}
                              {isSaved && (
                                <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                  Saved
                                </span>
                              )}
                            </div>
                          </div>
                          {isLocked ? (
                            <div className="space-y-2">
                              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                Winner:{" "}
                                {isDraw
                                  ? "Draw"
                                  : entry.winning_team === fixture.home_team_code
                                    ? homeName
                                    : entry.winning_team === fixture.away_team_code
                                      ? awayName
                                      : getTeam(entry.winning_team)?.name || entry.winning_team}
                                {!isDraw && entry.margin_band && ` • Margin: ${entry.margin_band}`}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingResultFixtureId(fixture.id)}
                                  className="rounded-md bg-blue-600 px-3 h-8 text-xs text-white transition-colors hover:bg-blue-700"
                                >
                                  Edit Result
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteResult(fixture.id)}
                                  className="rounded-md bg-red-600 px-3 h-8 text-xs text-white transition-colors hover:bg-red-700"
                                >
                                  Delete Result
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSetWinner(fixture.id, fixture.home_team_code)}
                                  disabled={isKickoffNull}
                                  className={`flex items-center gap-1 rounded-md px-2 h-8 text-xs transition-colors ${
                                    entry.winning_team === fixture.home_team_code
                                      ? "bg-blue-600 text-white"
                                      : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  } ${isKickoffNull ? "cursor-not-allowed opacity-50" : ""}`}
                                >
                                  {homeTeam?.logo_path && (
                                    <img
                                      src={homeTeam.logo_path}
                                      alt={homeName}
                                      className="h-4 w-4 object-contain"
                                    />
                                  )}
                                  <span>{homeName}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetWinner(fixture.id, fixture.away_team_code)}
                                  disabled={isKickoffNull}
                                  className={`flex items-center gap-1 rounded-md px-2 h-8 text-xs transition-colors ${
                                    entry.winning_team === fixture.away_team_code
                                      ? "bg-blue-600 text-white"
                                      : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  } ${isKickoffNull ? "cursor-not-allowed opacity-50" : ""}`}
                                >
                                  {awayTeam?.logo_path && (
                                    <img
                                      src={awayTeam.logo_path}
                                      alt={awayName}
                                      className="h-4 w-4 object-contain"
                                    />
                                  )}
                                  <span>{awayName}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetWinner(fixture.id, "DRAW")}
                                  disabled={isKickoffNull}
                                  className={`rounded-md px-2 h-8 text-xs transition-colors ${
                                    isDrawBool
                                      ? "bg-blue-600 text-white"
                                      : "bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                  } ${isKickoffNull ? "cursor-not-allowed opacity-50" : ""}`}
                                >
                                  Draw
                                </button>
                              </div>
                              <div className="flex gap-2 items-center">
                                <select
                                  value={entry.margin_band || ""}
                                  onChange={(e) => handleSetMargin(fixture.id, e.target.value === "" ? null : e.target.value)}
                                  disabled={isDrawBool || isKickoffNull}
                                  className={`rounded-md border border-zinc-300 px-2 h-8 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 ${
                                    isDrawBool || isKickoffNull
                                      ? "cursor-not-allowed opacity-50 bg-zinc-100 dark:bg-zinc-900"
                                      : ""
                                  }`}
                                >
                                  <option value="">Select margin</option>
                                  <option value="1-12">1-12</option>
                                  <option value="13+">13+</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveResult(fixture.id)}
                                  disabled={isKickoffNull}
                                  className={`rounded-md px-3 h-8 text-xs text-white transition-colors ${
                                    isKickoffNull
                                      ? "cursor-not-allowed opacity-50 bg-zinc-400"
                                      : "bg-green-600 hover:bg-green-700"
                                  }`}
                                >
                                  {isSaved ? "Update Result" : "Save"}
                                </button>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEditResult(fixture.id)}
                                    className="rounded-md border border-zinc-300 px-3 h-8 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Odds Panel */}
                        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 dark:bg-zinc-950 dark:border-zinc-800">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                              Odds (TAB Winning Margin)
                            </div>
                            {matchOdds[fixture.id] && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 text-right">
                                {new Date(matchOdds[fixture.id].odds_as_at).toLocaleString("en-NZ", {
                                  timeZone: "Pacific/Auckland",
                                  day: "numeric",
                                  month: "short",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </div>
                          {matchOdds[fixture.id] && editingOddsFixtureId !== fixture.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {homeName} 1–12
                                  </div>
                                  <div className="text-sm font-semibold text-black dark:text-zinc-50">
                                    {formatOdds(matchOdds[fixture.id].home_1_12_odds)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {homeName} 13+
                                  </div>
                                  <div className="text-sm font-semibold text-black dark:text-zinc-50">
                                    {formatOdds(matchOdds[fixture.id].home_13_plus_odds)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    Draw
                                  </div>
                                  <div className="text-sm font-semibold text-black dark:text-zinc-50">
                                    {formatOdds(matchOdds[fixture.id].draw_odds)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {awayName} 1–12
                                  </div>
                                  <div className="text-sm font-semibold text-black dark:text-zinc-50">
                                    {formatOdds(matchOdds[fixture.id].away_1_12_odds)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {awayName} 13+
                                  </div>
                                  <div className="text-sm font-semibold text-black dark:text-zinc-50">
                                    {formatOdds(matchOdds[fixture.id].away_13_plus_odds)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleEditOdds(fixture.id)}
                                  className="rounded-md bg-blue-600 px-3 h-8 text-xs text-white transition-colors hover:bg-blue-700"
                                >
                                  Edit odds
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {homeName} 1–12
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    value={oddsEntries[fixture.id]?.home_1_12_odds || ""}
                                    onChange={(e) => handleSetOdds(fixture.id, "home_1_12_odds", e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && !isNaN(Number(val))) {
                                        handleSetOdds(fixture.id, "home_1_12_odds", Number(val).toFixed(2));
                                      }
                                    }}
                                    className="w-full h-8 rounded-md border border-zinc-300 px-2 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                    placeholder="1.01"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {homeName} 13+
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    value={oddsEntries[fixture.id]?.home_13_plus_odds || ""}
                                    onChange={(e) => handleSetOdds(fixture.id, "home_13_plus_odds", e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && !isNaN(Number(val))) {
                                        handleSetOdds(fixture.id, "home_13_plus_odds", Number(val).toFixed(2));
                                      }
                                    }}
                                    className="w-full h-8 rounded-md border border-zinc-300 px-2 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                    placeholder="1.01"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    Draw
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    value={oddsEntries[fixture.id]?.draw_odds || ""}
                                    onChange={(e) => handleSetOdds(fixture.id, "draw_odds", e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && !isNaN(Number(val))) {
                                        handleSetOdds(fixture.id, "draw_odds", Number(val).toFixed(2));
                                      }
                                    }}
                                    className="w-full h-8 rounded-md border border-zinc-300 px-2 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                    placeholder="1.01"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {awayName} 1–12
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    value={oddsEntries[fixture.id]?.away_1_12_odds || ""}
                                    onChange={(e) => handleSetOdds(fixture.id, "away_1_12_odds", e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && !isNaN(Number(val))) {
                                        handleSetOdds(fixture.id, "away_1_12_odds", Number(val).toFixed(2));
                                      }
                                    }}
                                    className="w-full h-8 rounded-md border border-zinc-300 px-2 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                    placeholder="1.01"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                                    {awayName} 13+
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="1.01"
                                    value={oddsEntries[fixture.id]?.away_13_plus_odds || ""}
                                    onChange={(e) => handleSetOdds(fixture.id, "away_13_plus_odds", e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (val && !isNaN(Number(val))) {
                                        handleSetOdds(fixture.id, "away_13_plus_odds", Number(val).toFixed(2));
                                      }
                                    }}
                                    className="w-full h-8 rounded-md border border-zinc-300 px-2 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                                    placeholder="1.01"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveOdds(fixture.id)}
                                  disabled={savingOddsFixtureId === fixture.id}
                                  className="rounded-md bg-green-600 px-3 h-8 text-xs text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingOddsFixtureId === fixture.id ? "Saving..." : "Save odds"}
                                </button>
                                {editingOddsFixtureId === fixture.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEditOdds(fixture.id)}
                                    className="rounded-md border border-zinc-300 px-3 h-8 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Confirm Save Modal */}
        {confirmModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">Confirm Result</h3>
              <div className="space-y-2 text-sm text-black dark:text-zinc-50 mb-4">
                <div>
                  <span className="font-medium">Match {confirmModalData.fixture.match_number}:</span>{" "}
                  {getTeam(confirmModalData.fixture.home_team_code)?.name || confirmModalData.fixture.home_team_code} vs{" "}
                  {getTeam(confirmModalData.fixture.away_team_code)?.name || confirmModalData.fixture.away_team_code}
                </div>
                <div>
                  <span className="font-medium">Winner:</span>{" "}
                  {confirmModalData.entry.winning_team === "DRAW"
                    ? "Draw"
                    : getTeam(confirmModalData.entry.winning_team)?.name || confirmModalData.entry.winning_team}
                </div>
                <div>
                  <span className="font-medium">Margin:</span>{" "}
                  {confirmModalData.entry.winning_team === "DRAW"
                    ? "No margin"
                    : confirmModalData.entry.margin_band || "Not selected"}
                </div>
                <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                  {results[confirmModalData.fixtureId]
                    ? `Confirm updating result to ${confirmModalData.entry.winning_team === "DRAW" ? "Draw" : getTeam(confirmModalData.entry.winning_team)?.name || confirmModalData.entry.winning_team} / margin ${confirmModalData.entry.winning_team === "DRAW" ? "N/A" : confirmModalData.entry.margin_band || "N/A"}`
                    : `Confirm locking in result: ${confirmModalData.entry.winning_team === "DRAW" ? "Draw" : getTeam(confirmModalData.entry.winning_team)?.name || confirmModalData.entry.winning_team} ${confirmModalData.entry.winning_team === "DRAW" ? "" : confirmModalData.entry.margin_band ? `(${confirmModalData.entry.margin_band})` : ""}`}
                  {results[confirmModalData.fixtureId] && " This will update all participant scores."}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmModalData(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveResult}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Override pick Modal */}
        {overrideTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">Override pick</h3>
              <div className="space-y-3 text-sm text-black dark:text-zinc-50 mb-4">
                <div>
                  <span className="font-medium">Match {overrideTarget.fixture.match_number}:</span>{" "}
                  {getTeam(overrideTarget.fixture.home_team_code)?.name || overrideTarget.fixture.home_team_code} vs{" "}
                  {getTeam(overrideTarget.fixture.away_team_code)?.name || overrideTarget.fixture.away_team_code}
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Participant</label>
                  {(() => { console.log("[Override] overrideParticipants:", overrideParticipants.slice(0, 3)); return null; })()}
                  <select
                    value={overrideParticipantId}
                    onChange={(e) => setOverrideParticipantId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    <option value="">Select participant</option>
                    {overrideParticipants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.team_name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleBackfillPaperBets}
                      disabled={overrideConfirmText !== "OVERRIDE" || !overrideParticipantId || overrideLoading}
                      className="rounded-md border border-zinc-400 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {overrideLoading ? "Running…" : "Backfill paper bets"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Pick</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setOverridePickedTeamCode(overrideTarget.fixture.home_team_code); setOverrideMargin(1); }}
                      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                        overridePickedTeamCode === overrideTarget.fixture.home_team_code
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {getTeam(overrideTarget.fixture.home_team_code)?.name || overrideTarget.fixture.home_team_code}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOverridePickedTeamCode(overrideTarget.fixture.away_team_code); setOverrideMargin(1); }}
                      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                        overridePickedTeamCode === overrideTarget.fixture.away_team_code
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {getTeam(overrideTarget.fixture.away_team_code)?.name || overrideTarget.fixture.away_team_code}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOverridePickedTeamCode("DRAW"); setOverrideMargin(0); }}
                      className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                        overridePickedTeamCode === "DRAW"
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Draw
                    </button>
                  </div>
                </div>
                {overridePickedTeamCode && overridePickedTeamCode !== "DRAW" && (
                  <div>
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
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Type OVERRIDE to confirm
                  </label>
                  <input
                    type="text"
                    value={overrideConfirmText}
                    onChange={(e) => setOverrideConfirmText(e.target.value)}
                    placeholder="OVERRIDE"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeOverrideModal}
                  disabled={overrideLoading}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleOverrideSubmit("delete")}
                  disabled={overrideConfirmText !== "OVERRIDE" || overrideLoading || !overrideParticipantId}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete pick
                </button>
                <button
                  type="button"
                  onClick={() => handleOverrideSubmit("upsert")}
                  disabled={
                    overrideConfirmText !== "OVERRIDE" ||
                    overrideLoading ||
                    !overrideParticipantId ||
                    !overridePickedTeamCode ||
                    (overridePickedTeamCode !== "DRAW" && (overrideMargin !== 1 && overrideMargin !== 13))
                  }
                  className="rounded-md bg-green-600 px-4 py-2 text-sm text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Round Modal */}
        {deleteRoundTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">Delete round?</h3>
              <div className="space-y-2 text-sm text-black dark:text-zinc-50 mb-4">
                <p className="text-zinc-600 dark:text-zinc-400">
                  This will permanently delete the round. This cannot be undone.
                </p>
                {deleteRoundError && (
                  <p className="text-red-600 dark:text-red-400 text-sm mt-2">{deleteRoundError}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeDeleteRoundModal}
                  disabled={deleteRoundLoading}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteRound}
                  disabled={deleteRoundLoading}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteRoundLoading ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete Modal */}
        {deleteModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">Delete Result</h3>
              <div className="space-y-2 text-sm text-black dark:text-zinc-50 mb-4">
                <div>
                  <span className="font-medium">Match {deleteModalData.fixture.match_number}:</span>{" "}
                  {getTeam(deleteModalData.fixture.home_team_code)?.name || deleteModalData.fixture.home_team_code} vs{" "}
                  {getTeam(deleteModalData.fixture.away_team_code)?.name || deleteModalData.fixture.away_team_code}
                </div>
                <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                  This will remove the result and reset all participant scores for this match.
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteModalData(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteResult}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
                >
                  Delete Result
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
