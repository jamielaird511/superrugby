"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import PrintButton from "@/components/PrintButton";

type RoundScore = {
  participant_id: string;
  team_name: string;
  category: string | null;
  total_points: number;
};

type Round = {
  id: string;
  season: number;
  round_number: number;
};

function formatCategoryLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortLeaderboardRows<T extends { total_points: number; team_name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    return a.team_name.localeCompare(b.team_name);
  });
}

export default function PrintRoundLeaderboard() {
  const params = useParams();
  const roundId = params.roundId as string;
  const [scores, setScores] = useState<RoundScore[]>([]);
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!roundId) return;

      try {
        // Fetch round info (including league_id)
        const { data: roundData, error: roundError } = await supabase
          .from("rounds")
          .select("id, season, round_number, league_id")
          .eq("id", roundId)
          .single();

        if (roundError || !roundData) {
          console.error("Error fetching round:", roundError);
          setLoading(false);
          return;
        }

        setRound(roundData);

        // Fetch round leaderboard (filtered by round's league)
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from("leaderboard_round_public")
          .select("participant_id, team_name, category, total_points")
          .eq("round_id", roundId)
          .eq("league_id", roundData.league_id);

        if (leaderboardError) {
          console.error("Error fetching leaderboard:", leaderboardError);
          setScores([]);
        } else {
          const sorted = sortLeaderboardRows(leaderboardData || []);
          setScores(sorted);
        }

        // Fetch business names
        const { data: businessData, error: businessError } = await supabase
          .from("participants_public")
          .select("id, business_name");

        if (!businessError && businessData) {
          const map: Record<string, string> = {};
          businessData.forEach((r) => {
            if (r.id) map[r.id] = r.business_name ?? "";
          });
          setBusinessNames(map);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [roundId]);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          footer {
            display: none !important;
          }
          button {
            display: none !important;
          }
          body {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .print-container {
            max-width: 100%;
            padding: 0;
            width: 100%;
          }
          .print-content {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            padding: 6mm 10mm;
          }
          table {
            font-size: 11px;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          th, td {
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }
          @page {
            margin: 10mm;
            size: A4;
          }
        }
        @media screen {
          .print-container {
            max-width: 100%;
            margin: 0 auto;
            padding: 20px;
            background: white;
            min-h-screen;
          }
          .print-content {
            max-width: 672px;
            margin: 0 auto;
          }
        }
      `}</style>
      <div className="print-container bg-white">
        <div className="print-content">
          <div className="mb-6 no-print">
            <PrintButton onClick={() => window.print()} />
          </div>
          <h1 className="text-2xl font-bold text-[#003A5D] mb-6">
            Round {round?.round_number || "—"} Results
          </h1>
          <table className="min-w-full divide-y divide-zinc-200 border border-zinc-300">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                  Business
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-zinc-300">
                  Category
                </th>
                <th className="px-4 py-3 w-[110px] text-right text-xs font-semibold text-zinc-700 uppercase tracking-wider border-b border-zinc-300">
                  Points
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200">
              {scores.map((score, index) => {
                const business = businessNames[score.participant_id] || "—";
                const category = score.category ? formatCategoryLabel(score.category) : "—";
                return (
                  <tr key={score.participant_id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-900">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-900">{score.team_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-600 max-w-[260px]">
                      <span className="block truncate" title={business}>{business}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 max-w-[140px]">
                      <span className="block truncate" title={category}>{category}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap w-[110px] text-sm text-zinc-900 text-right font-semibold">{score.total_points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
