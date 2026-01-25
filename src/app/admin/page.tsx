"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Round = {
  id: string;
  season: number;
  round_number: number;
  lock_time: string | null;
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

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [resultEntries, setResultEntries] = useState<Record<string, { winning_team: string; margin_band: string | null }>>({});
  const [editingResultFixtureId, setEditingResultFixtureId] = useState<string | null>(null);
  const [confirmModalData, setConfirmModalData] = useState<{ fixtureId: string; fixture: Fixture; entry: { winning_team: string; margin_band: string | null } } | null>(null);
  const [deleteModalData, setDeleteModalData] = useState<{ fixtureId: string; fixture: Fixture } | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Round form state
  const [roundSeason, setRoundSeason] = useState<number>(new Date().getFullYear());
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // Fixture form state
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null);
  const [fixtureMatchNumber, setFixtureMatchNumber] = useState<number>(1);
  const [fixtureHomeTeamCode, setFixtureHomeTeamCode] = useState<string>("");
  const [fixtureAwayTeamCode, setFixtureAwayTeamCode] = useState<string>("");
  const [fixtureKickoffAt, setFixtureKickoffAt] = useState<string>("");

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
    };

    checkAdmin();
  }, [router]);

  // Fetch fixtures when round is selected (only if admin)
  useEffect(() => {
    if (!isAdmin) return;
    
    if (selectedRoundId) {
      fetchFixtures(selectedRoundId);
    } else {
      setFixtures([]);
      setResults({});
      setResultEntries({});
      setEditingResultFixtureId(null);
      setEditingFixtureId(null);
      setFixtureMatchNumber(1);
      setFixtureHomeTeamCode("");
      setFixtureAwayTeamCode("");
      setFixtureKickoffAt("");
    }
  }, [selectedRoundId, isAdmin]);

  const fetchRounds = async () => {
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
  };

  const fetchTeams = async () => {
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
  };

  const fetchFixtures = async (roundId: string) => {
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
          fetchResults(data.map((f) => f.id));
        } else {
          setResults({});
          setResultEntries({});
        }
      }
    } catch (err) {
      console.error("Unexpected error fetching fixtures:", err);
      setMessage({ type: "error", text: `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
  };

  const fetchResults = async (fixtureIds: string[]) => {
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
  };

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
      let result: any;
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

      const fixtureData: any = {
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
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Admin - Rounds & Fixtures</h1>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            ← Back to Home
          </Link>
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
                  </div>
                ))
              )}
            </div>
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
              <div className="space-y-2">
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
                      className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm text-black dark:text-zinc-50">
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
                          <span>— {kickoffStr}</span>
                        </div>
                        <div className="flex gap-2">
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
                      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                          Result {isSaved && <span className="text-green-600 dark:text-green-400">(Saved)</span>}
                        </div>
                        {isKickoffNull ? (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                              Kickoff time not set — cannot enter result.
                            </div>
                          </div>
                        ) : isKickoffInFuture ? (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                              Kickoff hasn&apos;t happened yet — double-check before saving.
                            </div>
                          </div>
                        ) : null}
                        {isLocked ? (
                          <div className="flex items-center gap-2">
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
                            <button
                              type="button"
                              onClick={() => setEditingResultFixtureId(fixture.id)}
                              className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-700"
                            >
                              Edit Result
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteResult(fixture.id)}
                              className="rounded-md bg-red-600 px-3 py-1 text-xs text-white transition-colors hover:bg-red-700"
                            >
                              Delete Result
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetWinner(fixture.id, fixture.home_team_code)}
                                disabled={isKickoffNull}
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                  entry.winning_team === fixture.home_team_code
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
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
                                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                  entry.winning_team === fixture.away_team_code
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
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
                                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                                  isDrawBool
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                                } ${isKickoffNull ? "cursor-not-allowed opacity-50" : ""}`}
                              >
                                Draw
                              </button>
                            </div>
                            <select
                              value={entry.margin_band || ""}
                              onChange={(e) => handleSetMargin(fixture.id, e.target.value === "" ? null : e.target.value)}
                              disabled={isDrawBool || isKickoffNull}
                              className={`rounded-md border border-zinc-300 px-2 py-1 text-xs text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 ${
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
                              className={`rounded-md px-3 py-1 text-xs text-white transition-colors ${
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
                                className="rounded-md border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              >
                                Cancel
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
    </div>
  );
}
