"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  round_id: string;
  participant_id: string;
  team_name: string;
  business_name: string;
  round_points: number;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const ranked = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      if (b.round_points !== a.round_points) return b.round_points - a.round_points;
      return a.team_name.localeCompare(b.team_name);
    });

    let lastPts: number | null = null;
    let lastRank = 0;

    return sorted.map((r, idx) => {
      const rank = lastPts === r.round_points ? lastRank : idx + 1;
      lastPts = r.round_points;
      lastRank = rank;
      return { ...r, rank };
    });
  }, [rows]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) {
        router.push("/");
        return;
      }

      const nowISO = new Date().toISOString();
      const { data: upcoming, error: upErr } = await supabase
        .from("fixtures")
        .select("round_id, kickoff_at")
        .gt("kickoff_at", nowISO)
        .order("kickoff_at", { ascending: true })
        .limit(1);

      if (upErr) {
        setError(upErr.message);
        setLoading(false);
        return;
      }

      const currentRoundId = upcoming?.[0]?.round_id ?? null;
      if (!currentRoundId) {
        setRoundId(null);
        setRows([]);
        setLoading(false);
        return;
      }
      setRoundId(currentRoundId);

      const { data: lb, error: lbErr } = await supabase
        .from("v_round_leaderboard")
        .select("round_id, participant_id, team_name, business_name, round_points")
        .eq("round_id", currentRoundId);

      if (lbErr) {
        setError(lbErr.message);
        setLoading(false);
        return;
      }

      setRows((lb as Row[]) || []);
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center font-sans">
        <div className="text-zinc-600">Loading leaderboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center font-sans">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 font-sans">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black">Leaderboard</h1>
            <div className="text-sm text-zinc-600">
              {roundId ? `Current round` : `No upcoming round found`}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              localStorage.removeItem("participant_id");
              window.location.href = "/";
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Log out
          </button>
        </div>

        {ranked.length === 0 ? (
          <div className="rounded-md border border-zinc-200 bg-white p-4 text-zinc-600">
            No leaderboard data yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
            <div className="grid grid-cols-[70px_1fr_110px] gap-0 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <div>Rank</div>
              <div>Team</div>
              <div className="text-right">Points</div>
            </div>

            {ranked.map((r) => (
              <div
                key={r.participant_id}
                className="grid grid-cols-[70px_1fr_110px] items-center px-4 py-3 border-b last:border-b-0 border-zinc-100"
              >
                <div className="text-sm font-semibold text-zinc-700">{r.rank}</div>
                <div>
                  <div className="text-sm font-semibold text-black">{r.team_name}</div>
                  <div className="text-xs text-zinc-500">{r.business_name}</div>
                </div>
                <div className="text-right text-sm font-semibold text-black">
                  {r.round_points}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
