"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Round = { id: string; round_number: number; season: number };
type Row = {
  participant_id: string;
  team_name: string;
  bets_count: number;
  wins_count: number;
  total_staked: number;
  total_return: number;
  profit: number;
  roi: number;
};

export default function PaperbetsResultsPage() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundId, setRoundId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("rounds")
          .select("id, round_number, season")
          .order("season", { ascending: false })
          .order("round_number", { ascending: false });
        if (!error) setRounds(data ?? []);
      } catch {
        // keep page usable even if rounds fail
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const qs = roundId ? `?round_id=${encodeURIComponent(roundId)}` : "";
        const res = await fetch(`/api/admin/paperbets-leaderboard${qs}`, {
          cache: "no-store",
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load leaderboard");
        setRows(json.rows ?? []);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Failed to load");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [roundId]);

  const title = useMemo(() => {
    if (!roundId) return "Paperbets Leaderboard — Season Total";
    const r = rounds.find((x) => x.id === roundId);
    return r ? `Paperbets Leaderboard — Round ${r.round_number} (${r.season})` : "Paperbets Leaderboard — Round";
  }, [roundId, rounds]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm opacity-75 mt-1">Settled paper bets by participant. Filter by round or view season total.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Round</label>
            <select
              className="border rounded px-3 py-2 bg-white dark:bg-zinc-900 dark:border-zinc-700"
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
            >
              <option value="">All season</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.season} — Round {r.round_number}
                </option>
              ))}
            </select>
          </div>
          <Link href="/admin" className="text-sm underline">
            Back to Admin
          </Link>
        </div>
      </div>

      {err && (
        <div className="border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-300 rounded p-3">
          {err}
        </div>
      )}

      <div className="border rounded overflow-hidden dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-zinc-800">
            <tr>
              <th className="text-left p-3">Rank</th>
              <th className="text-left p-3">Team</th>
              <th className="text-right p-3">Bets</th>
              <th className="text-right p-3">Wins</th>
              <th className="text-right p-3">Staked</th>
              <th className="text-right p-3">Return</th>
              <th className="text-right p-3">Profit</th>
              <th className="text-right p-3">ROI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={8}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.participant_id} className="border-t dark:border-zinc-700">
                  <td className="p-3">{idx + 1}</td>
                  <td className="p-3 font-medium">{r.team_name}</td>
                  <td className="p-3 text-right">{r.bets_count}</td>
                  <td className="p-3 text-right">{r.wins_count}</td>
                  <td className="p-3 text-right">{Number(r.total_staked).toFixed(1)}</td>
                  <td className="p-3 text-right">{Number(r.total_return).toFixed(1)}</td>
                  <td className="p-3 text-right">{Number(r.profit).toFixed(1)}</td>
                  <td className="p-3 text-right">{(Number(r.roi) * 100).toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
