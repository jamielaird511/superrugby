"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Round = {
  id: string;
  season: number;
  round_number: number;
};

type PaperPunterResult = {
  participant_id: string;
  team_name: string;
  staked: number;
  return: number;
  profit: number;
  roi: number;
  biggest_hit: number;
  prophet_score: number;
};

export default function PaperPunterPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [results, setResults] = useState<PaperPunterResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [latestOddsAsAt, setLatestOddsAsAt] = useState<string | null>(null);

  // Fetch rounds
  useEffect(() => {
    async function fetchRounds() {
      try {
        const { data, error } = await supabase
          .from("rounds")
          .select("id, season, round_number")
          .order("season", { ascending: false })
          .order("round_number", { ascending: false });

        if (error) {
          console.error("Error fetching rounds:", error);
        } else {
          setRounds(data || []);
          // Default to first round
          if (data && data.length > 0 && !selectedRoundId) {
            setSelectedRoundId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching rounds:", err);
      }
    }
    fetchRounds();
  }, []);

  // Fetch paper punter results when round is selected
  useEffect(() => {
    async function fetchResults() {
      if (!selectedRoundId) {
        setResults([]);
        setLatestOddsAsAt(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch latest odds_as_at for this round
        const { data: fixturesData } = await supabase
          .from("fixtures")
          .select("id")
          .eq("round_id", selectedRoundId);

        if (fixturesData && fixturesData.length > 0) {
          const fixtureIds = fixturesData.map((f) => f.id);
          const { data: oddsData } = await supabase
            .from("match_odds")
            .select("odds_as_at")
            .in("fixture_id", fixtureIds)
            .order("odds_as_at", { ascending: false })
            .limit(1);

          if (oddsData && oddsData.length > 0) {
            setLatestOddsAsAt(oddsData[0].odds_as_at);
          }
        }

        // Fetch paper punter results
        const response = await fetch(`/api/paper-punter?roundId=${selectedRoundId}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch results");
        }

        const result = await response.json();
        setResults(result.data || []);
      } catch (err) {
        console.error("Error fetching paper punter results:", err);
        setError(err instanceof Error ? err.message : "Failed to load results");
        setResults([]);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [selectedRoundId]);

  const selectedRound = rounds.find((r) => r.id === selectedRoundId);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 mb-2">
            Paper Punter
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            $10 per match (fun only — not part of official scoring)
          </p>
          {latestOddsAsAt && (
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Odds as at: {new Date(latestOddsAsAt).toLocaleString("en-NZ", {
                timeZone: "Pacific/Auckland",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Round selector */}
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Round
          </label>
          <select
            value={selectedRoundId || ""}
            onChange={(e) => setSelectedRoundId(e.target.value || null)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-black dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">Select a round</option>
            {rounds.map((round) => (
              <option key={round.id} value={round.id}>
                Season {round.season} - Round {round.round_number}
              </option>
            ))}
          </select>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Results table */}
        {loading ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
          </div>
        ) : !selectedRoundId ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">Select a round</p>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              No results available. Ensure odds and results are entered for this round.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Team
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Profit ($)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    ROI (%)
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Prophet Score
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Biggest Hit ($)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {results.map((result, index) => (
                  <tr key={result.participant_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {result.team_name}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      result.profit >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {result.profit >= 0 ? "+" : ""}{result.profit.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${
                      result.roi >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {result.roi >= 0 ? "+" : ""}{result.roi.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-50">
                      {result.prophet_score.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-50">
                      {result.biggest_hit > 0 ? `+${result.biggest_hit.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
