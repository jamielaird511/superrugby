"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PrintButton from "@/components/PrintButton";

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

type Round = {
  id: string;
  season: number;
  round_number: number;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const fmtCurrency = (n: number) => `$${Number(n).toFixed(2)}`;

function parseRoiPercent(roi: unknown): number {
  if (roi == null) return NaN;
  if (typeof roi === "number") {
    return roi >= 0 && roi <= 3 ? roi * 100 : roi;
  }
  if (typeof roi === "string") {
    const n = parseFloat(String(roi).replace(/%/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function roiClass(roi: unknown): string {
  const n = parseRoiPercent(roi);
  if (Number.isNaN(n)) return "";
  if (n >= 0) return "bg-green-50 text-green-800";
  return "bg-red-50 text-red-800";
}

const COL_COUNT = 8;

function renderRoiTableRows(rows: LeaderboardRow[]) {
  const cutIndex = rows.findIndex((r) => parseRoiPercent(r.roi) < 0);
  const showCutLine = cutIndex > 0 && cutIndex < rows.length;

  const nodes: React.ReactNode[] = [];
  rows.forEach((r, i) => {
    if (showCutLine && i === cutIndex) {
      nodes.push(
        <tr key={`cut-${i}`}>
          <td colSpan={COL_COUNT} className="border-t-2 border-zinc-400 bg-zinc-50 py-2 text-center text-xs font-medium text-zinc-700">
            Cut line — 0% ROI (break-even)
          </td>
        </tr>
      );
    }
    nodes.push(
      <tr key={r.participant_id}>
        <td className="text-center">{i + 1}</td>
        <td className="text-left">{r.team_name}</td>
        <td className="text-center">{r.bets_count}</td>
        <td className="text-center">{r.wins_count}</td>
        <td className="text-center">{fmtCurrency(r.total_staked)}</td>
        <td className="text-center">{fmtCurrency(r.total_return)}</td>
        <td className="text-center">{fmtCurrency(r.profit)}</td>
        <td className={`text-center ${roiClass(r.roi)}`}>{(Number(r.roi) * 100).toFixed(1)}%</td>
      </tr>
    );
  });
  return nodes;
}

export default function PaperBetsPrintClient() {
  const searchParams = useSearchParams();
  const roundId = searchParams.get("round") ?? "";
  const seasonParam = searchParams.get("season") ?? "";

  const [round, setRound] = useState<Round | null>(null);
  const [roundDate, setRoundDate] = useState<string>("");
  const [roundRows, setRoundRows] = useState<LeaderboardRow[]>([]);
  const [seasonRows, setSeasonRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }
        const headers: HeadersInit = { Authorization: `Bearer ${token}` };

        const [roundRes, seasonRes] = await Promise.all([
          roundId ? fetch(`/api/admin/paperbets-leaderboard?round_id=${encodeURIComponent(roundId)}`, { cache: "no-store", headers }) : null,
          fetch("/api/admin/paperbets-leaderboard", { cache: "no-store", headers }),
        ]);

        if (cancelled) return;

        const seasonJson = await seasonRes.json();
        if (!seasonRes.ok) {
          setError(seasonJson?.error || "Failed to load leaderboard");
          setSeasonRows([]);
          setRoundRows([]);
          setLoading(false);
          return;
        }
        setSeasonRows(seasonJson.rows ?? []);

        if (roundRes) {
          const roundJson = await roundRes.json();
          if (!roundRes.ok) {
            setError(roundJson?.error || "Failed to load round leaderboard");
            setRoundRows([]);
          } else {
            setRoundRows(roundJson.rows ?? []);
          }
        } else {
          setRoundRows([]);
        }

        if (roundId) {
          const { data: roundData } = await supabase
            .from("rounds")
            .select("id, season, round_number")
            .eq("id", roundId)
            .single();
          if (roundData && !cancelled) setRound(roundData as Round);

          const { data: fixtureData } = await supabase
            .from("fixtures")
            .select("kickoff_at")
            .eq("round_id", roundId)
            .order("kickoff_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (fixtureData?.kickoff_at && !cancelled) {
            setRoundDate(fmtDate(fixtureData.kickoff_at));
          }
        } else {
          setRound(null);
          setRoundDate("");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [roundId]);

  const roundLabel = round ? `Round ${round.round_number}${round.season != null ? `, ${round.season}` : ""}` : seasonParam ? `Season ${seasonParam}` : "";
  const subtitle = round ? (roundDate ? `${roundLabel} · ${roundDate}` : roundLabel) : roundLabel;

  const topRoiTeam = roundRows.length > 0 ? roundRows[0] : null;
  const biggestProfit = roundRows.length > 0 ? roundRows.reduce((best, r) => (r.profit > best.profit ? r : best), roundRows[0]) : null;

  const showRoundSection = roundId && roundRows.length > 0;

  if (loading) {
    return (
      <div className="print-content p-8 text-center text-black">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="print-content p-8 text-center text-black">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .print-content { max-width: 800px; margin: 0 auto; padding: 16px; }
          .print-content table { border-collapse: collapse; font-size: 12px; }
          .print-content th, .print-content td { border: 1px solid #333; padding: 6px 8px; }
          .print-content th { background: #f5f5f5; font-weight: 600; }
          .print-content th.text-center, .print-content td.text-center { text-align: center; }
          .print-content th.text-left, .print-content td.text-left { text-align: left; }
          .print-content thead { display: table-header-group; }
          .print-content tr { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          .print-content { max-width: 800px; margin: 0 auto; padding: 24px; background: white; color: black; font-family: system-ui, -apple-system, sans-serif; }
          .print-content table { border-collapse: collapse; font-size: 13px; }
          .print-content th, .print-content td { border: 1px solid #333; padding: 6px 8px; }
          .print-content th { background: #f5f5f5; font-weight: 600; }
          .print-content th.text-center, .print-content td.text-center { text-align: center; }
          .print-content th.text-left, .print-content td.text-left { text-align: left; }
        }
      `}</style>
      <div className="print-content bg-white text-black">
        <div className="no-print mb-4">
          <PrintButton onClick={() => window.print()} />
        </div>

        <h1 className="text-xl font-bold mb-1">PaperPunter Results</h1>
        {subtitle && <p className="text-sm text-zinc-600 mb-6">{subtitle}</p>}

        {showRoundSection && (
          <section className="mb-6">
            <h2 className="text-base font-semibold mb-2">Round highlights</h2>
            <div className="text-sm mb-4">
              {topRoiTeam && (
                <p>Top ROI: {topRoiTeam.team_name} ({(Number(topRoiTeam.roi) * 100).toFixed(1)}%)</p>
              )}
              {biggestProfit && biggestProfit.bets_count > 0 && (
                <p>Biggest profit: {biggestProfit.team_name} ({Number(biggestProfit.profit).toFixed(1)})</p>
              )}
            </div>

            <h3 className="text-sm font-semibold mb-2">Round ROI</h3>
            <table className="w-full mb-4">
              <thead>
                <tr>
                  <th className="text-center">Rank</th>
                  <th className="text-left">Team</th>
                  <th className="text-center">Bets</th>
                  <th className="text-center">Wins</th>
                  <th className="text-center">Staked</th>
                  <th className="text-center">Return</th>
                  <th className="text-center">Profit</th>
                  <th className="text-center">ROI</th>
                </tr>
              </thead>
              <tbody>
                {renderRoiTableRows(roundRows)}
              </tbody>
            </table>
          </section>
        )}

        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Season ROI</h3>
          <table className="w-full mb-4">
            <thead>
              <tr>
                <th className="text-center">Rank</th>
                <th className="text-left">Team</th>
                <th className="text-center">Bets</th>
                <th className="text-center">Wins</th>
                <th className="text-center">Staked</th>
                <th className="text-center">Return</th>
                <th className="text-center">Profit</th>
                <th className="text-center">ROI</th>
              </tr>
            </thead>
            <tbody>
              {renderRoiTableRows(seasonRows)}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
