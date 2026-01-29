"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CompetitionRow = {
  id: string;
  competition_code: string;
  name: string;
  sport: string | null;
  season: number | null;
  leagues_count: number;
  rounds_count: number;
  fixtures_count: number;
};

type LeagueRow = {
  id: string;
  league_code: string;
  name: string;
  competition_id: string;
  competition_code: string | null;
  participants_count: number;
  created_at: string;
};

export default function AdminStructurePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);

  // Admin gate: reuse same pattern as main admin page
  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmails =
        envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const userIsAdmin =
        adminEmails.length > 0 &&
        userEmailLower &&
        adminEmails.includes(userEmailLower);

      if (!userIsAdmin) {
        router.replace("/");
        setAuthChecked(true);
        return;
      }

      setIsAdmin(true);
      setAuthChecked(true);
    };

    checkAdmin();
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchStructure = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const resp = await fetch("/api/admin/structure", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          setError(body.error || `Failed to load structure (status ${resp.status})`);
          setLoading(false);
          return;
        }

        const body: { competitions: CompetitionRow[]; leagues: LeagueRow[] } =
          await resp.json();
        setCompetitions(body.competitions || []);
        setLeagues(body.leagues || []);
      } catch (err) {
        setError(
          `Unexpected error: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStructure();
  }, [isAdmin]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            Checking access...
          </p>
        </div>
      </div>
    );
  }

  if (authChecked && !isAdmin) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
          Admin - Structure
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Competitions and leagues overview (read-only)
        </p>
      </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            Loading structure…
          </div>
        ) : (
          <div className="space-y-8">
            {/* Competitions table */}
            <section>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-3">
                Competitions
              </h2>
              {competitions.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No competitions found.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/40">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Code
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Name
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Sport
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Season
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                          Leagues
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                          Rounds
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                          Fixtures
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {competitions.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {c.competition_code}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-zinc-900 dark:text-zinc-50">
                            {c.name}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                            {c.sport || "—"}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                            {c.season ?? "—"}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-50">
                            {c.leagues_count}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-50">
                            {c.rounds_count}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-50">
                            {c.fixtures_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Leagues table */}
            <section>
              <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-3">
                Leagues
              </h2>
              {leagues.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No leagues found.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-950/40">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Code
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Name
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Competition
                        </th>
                        <th className="px-2 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                          Teams
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-zinc-700 dark:text-zinc-300">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {leagues.map((l) => (
                        <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                          <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-zinc-700 dark:text-zinc-300">
                            {l.league_code}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-zinc-900 dark:text-zinc-50">
                            {l.name}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300">
                            {l.competition_code || "—"}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-right text-zinc-900 dark:text-zinc-50">
                            {l.participants_count}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-zinc-700 dark:text-zinc-300 text-xs">
                            {l.created_at
                              ? new Date(l.created_at).toLocaleString("en-NZ", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
    </>
  );
}

