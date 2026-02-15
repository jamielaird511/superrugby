"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import PrintButton from "@/components/PrintButton";

type OverallScore = {
  participant_id: string;
  team_name: string;
  category: string | null;
  total_points: number;
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

export default function PrintOverallLeaderboardClient({
  leagueIdParam,
}: {
  leagueIdParam: string | undefined;
}) {
  const [scores, setScores] = useState<OverallScore[]>([]);
  const [businessNames, setBusinessNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get league_id from query param or default to ANZ2026
        let targetLeagueId: string | null = null;

        if (leagueIdParam) {
          targetLeagueId = leagueIdParam;
        } else {
          // Default to ANZ2026 league
          const { data: defaultLeague } = await supabase
            .from("leagues")
            .select("id")
            .eq("league_code", "ANZ2026")
            .single();
          targetLeagueId = defaultLeague?.id || null;
        }

        if (!targetLeagueId) {
          console.error("Could not determine league");
          setLoading(false);
          return;
        }

        // Fetch overall leaderboard (filtered by league)
        const { data: leaderboardData, error: leaderboardError } = await supabase
          .from("leaderboard_overall_public")
          .select("participant_id, team_name, category, total_points")
          .eq("league_id", targetLeagueId);

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
  }, [leagueIdParam]);

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
          .print-container,
          .print-content {
            width: 100% !important;
            max-width: none !important;
            padding: 0;
          }
          .print-content {
            margin: 0 auto;
            padding: 6mm 10mm;
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
        <div className="mx-auto w-full max-w-[860px] px-6 pt-8 pb-8">
          <div className="mb-6 no-print">
            <PrintButton onClick={() => window.print()} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-4">Overall Leaderboard</h1>
          <div className="w-full rounded-md border border-slate-300 overflow-hidden">
            <table className="w-full table-fixed border-collapse text-[13px] text-slate-800" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "44px" }} />
                <col style={{ width: "240px" }} />
                <col style={{ width: "240px" }} />
                <col style={{ width: "150px" }} />
                <col style={{ width: "72px" }} />
              </colgroup>
              <thead className="bg-slate-100">
                <tr className="border-b border-slate-300">
                  <th className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-700 text-center">
                    Rank
                  </th>
                  <th className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-700 text-left">
                    Team
                  </th>
                  <th className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-700 text-left">
                    Business
                  </th>
                  <th className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-700 text-left">
                    Category
                  </th>
                  <th className="px-2 py-2 text-[11px] font-semibold tracking-wide text-slate-700 text-center">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => {
                  const business = businessNames[score.participant_id] || "—";
                  const category = score.category ? formatCategoryLabel(score.category) : "—";
                  return (
                    <tr key={score.participant_id} className="border-b border-slate-200 odd:bg-white even:bg-slate-50">
                      <td className="px-2 py-2 whitespace-nowrap text-center text-slate-900">{index + 1}</td>
                      <td className="px-2 py-2 truncate text-left font-medium text-slate-900" title={score.team_name}>{score.team_name}</td>
                      <td className="px-2 py-2 truncate text-left text-slate-600" title={business}>{business}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-left text-slate-600">{category}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-center font-semibold text-slate-900">{score.total_points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
