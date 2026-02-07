"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LeaderboardRow = {
  participant_id: string;
  team_name: string;
  bets_count: number;
  wins_count: number;
  total_staked: number;
  total_return: number;
  profit: number;
  roi: number;
};

function LeaderboardTable({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: LeaderboardRow[];
  loading: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>{title}</h3>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <th style={{ padding: "8px 6px" }}>Rank</th>
              <th style={{ padding: "8px 6px" }}>Team</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Bets</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Wins</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Staked</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Return</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>Profit</th>
              <th style={{ padding: "8px 6px", textAlign: "right" }}>ROI</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={{ padding: 12 }} colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td style={{ padding: 12 }} colSpan={8}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.participant_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 6px" }}>{idx + 1}</td>
                  <td style={{ padding: "8px 6px", fontWeight: 500 }}>{r.team_name}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{r.bets_count}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{r.wins_count}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {Number(r.total_staked).toFixed(1)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {Number(r.total_return).toFixed(1)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {Number(r.profit).toFixed(1)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {(Number(r.roi) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PaperBetsLeaderboardSection({ roundId }: { roundId: string }) {
  const [leaderboardRoundRows, setLeaderboardRoundRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardSeasonRows, setLeaderboardSeasonRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [seasonRes, roundRes] = await Promise.all([
          fetch("/api/admin/paperbets-leaderboard", { cache: "no-store", headers }),
          roundId
            ? fetch(`/api/admin/paperbets-leaderboard?round_id=${encodeURIComponent(roundId)}`, {
                cache: "no-store",
                headers,
              })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const seasonJson = await seasonRes.json();
        if (!seasonRes.ok) throw new Error(seasonJson?.error || "Failed to load season leaderboard");
        setLeaderboardSeasonRows(seasonJson.rows ?? []);

        if (roundRes) {
          const roundJson = await roundRes.json();
          if (!roundRes.ok) throw new Error(roundJson?.error || "Failed to load round leaderboard");
          setLeaderboardRoundRows(roundJson.rows ?? []);
        } else {
          setLeaderboardRoundRows([]);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setLeaderboardError(e instanceof Error ? e.message : "Failed to load leaderboard");
          setLeaderboardRoundRows([]);
          setLeaderboardSeasonRows([]);
        }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  return (
    <div style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>Leaderboard</h2>
      {leaderboardError && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #ef4444",
            borderRadius: 8,
          }}
        >
          {leaderboardError}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <LeaderboardTable
          title="Round ROI (this round)"
          rows={leaderboardRoundRows}
          loading={leaderboardLoading && !!roundId}
        />
        <LeaderboardTable
          title="Season Total ROI"
          rows={leaderboardSeasonRows}
          loading={leaderboardLoading}
        />
      </div>
    </div>
  );
}
