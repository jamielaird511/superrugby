"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WorldCupAdminHeader from "@/components/worldcup/WorldCupAdminHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupContentCardClass,
  worldCupDataTableWrapClass,
  worldCupEmptyStateBoxClass,
  worldCupMainContentShellClass,
  worldCupPrimaryButtonInlineClass,
  worldCupSelectControlClass,
} from "@/lib/worldCupBranding";

type TeamOpt = { code: string; name: string };

type KnockoutFixtureRow = {
  id: string;
  match_number: number;
  phase: string;
  round_number: number;
  kickoff_at: string | null;
  home_team_code: string | null;
  away_team_code: string | null;
};

type Section = { phase: string; fixtures: KnockoutFixtureRow[] };

function formatKickoffNz(kickoffAt: string | null) {
  if (!kickoffAt) return "—";
  return new Date(kickoffAt).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildDrafts(sections: Section[]) {
  const d: Record<string, { home: string; away: string }> = {};
  for (const s of sections) {
    for (const f of s.fixtures) {
      d[f.id] = {
        home: f.home_team_code ?? "",
        away: f.away_team_code ?? "",
      };
    }
  }
  return d;
}

export default function WorldCupAdminKnockoutFixturesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [flashSavedId, setFlashSavedId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const flashSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPayload = useCallback((payload: { sections: Section[]; teams: TeamOpt[] }) => {
    setSections(payload.sections || []);
    setTeams(payload.teams || []);
    setDrafts(buildDrafts(payload.sections || []));
  }, []);

  useEffect(() => {
    return () => {
      if (flashSavedTimerRef.current) clearTimeout(flashSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userError || !user) {
        router.replace("/worldcup/admin/login");
        setAuthChecked(true);
        return;
      }

      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmails = envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const ok =
        adminEmails.length > 0 && userEmailLower && adminEmails.includes(userEmailLower);

      if (!ok) {
        router.replace("/worldcup/admin/login");
        setAuthChecked(true);
        return;
      }

      setAllowed(true);
      setAuthChecked(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setLoadError("Not signed in");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/worldcup/admin/knockout-fixtures", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          error?: string;
          sections?: Section[];
          teams?: TeamOpt[];
        };
        if (!res.ok) {
          setLoadError(json?.error || `Request failed (${res.status})`);
          setLoading(false);
          return;
        }
        applyPayload({
          sections: Array.isArray(json.sections) ? json.sections : [],
          teams: Array.isArray(json.teams) ? json.teams : [],
        });
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, applyPayload]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAllowed(false);
    router.replace("/worldcup/login");
  }

  function setDraft(fixtureId: string, side: "home" | "away", value: string) {
    setDrafts((prev) => {
      const cur = prev[fixtureId] || { home: "", away: "" };
      const next = { ...cur, [side]: value };
      if (side === "home" && value && next.away === value) next.away = "";
      if (side === "away" && value && next.home === value) next.home = "";
      return { ...prev, [fixtureId]: next };
    });
    setRowErrors((prev) => {
      if (!prev[fixtureId]) return prev;
      const { [fixtureId]: _, ...rest } = prev;
      return rest;
    });
  }

  async function saveFixture(fixtureId: string) {
    const d = drafts[fixtureId];
    if (!d) return;

    setRowErrors((prev) => {
      const { [fixtureId]: _, ...rest } = prev;
      return rest;
    });
    setSavingId(fixtureId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setRowErrors((prev) => ({
          ...prev,
          [fixtureId]: "Session expired; sign in again.",
        }));
        return;
      }

      const homeTeamCode = d.home.trim() || null;
      const awayTeamCode = d.away.trim() || null;

      const res = await fetch("/api/worldcup/admin/knockout-fixtures", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fixtureId,
          homeTeamCode,
          awayTeamCode,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        fixture?: { id: string; home_team_code: string | null; away_team_code: string | null };
      };
      if (!res.ok) {
        setRowErrors((prev) => ({
          ...prev,
          [fixtureId]: json?.error || "Save failed",
        }));
        return;
      }

      const saved = json.fixture;
      if (saved) {
        setDrafts((prev) => ({
          ...prev,
          [fixtureId]: {
            home: saved.home_team_code ?? "",
            away: saved.away_team_code ?? "",
          },
        }));
        setSections((prev) =>
          prev.map((sec) => ({
            ...sec,
            fixtures: sec.fixtures.map((f) =>
              f.id === fixtureId
                ? {
                    ...f,
                    home_team_code: saved.home_team_code,
                    away_team_code: saved.away_team_code,
                  }
                : f
            ),
          }))
        );
      }

      setFlashSavedId(fixtureId);
      if (flashSavedTimerRef.current) clearTimeout(flashSavedTimerRef.current);
      flashSavedTimerRef.current = setTimeout(() => {
        setFlashSavedId(null);
        flashSavedTimerRef.current = null;
      }, 2500);
    } catch {
      setRowErrors((prev) => ({ ...prev, [fixtureId]: "Save failed" }));
    } finally {
      setSavingId(null);
    }
  }

  if (!authChecked) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center overflow-x-hidden text-white"
        style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
      >
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  const selectClass = `${worldCupSelectControlClass} min-w-[140px] max-w-[200px] bg-white text-sm text-slate-900`;

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupAdminHeader subtitle="Admin — knockout fixtures" onLogout={handleLogout} />

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
            <h1 className="text-2xl font-semibold text-slate-900">Knockout fixtures</h1>
            <p className="mt-2 text-sm text-slate-600">
              Assign home and away teams for knockout matches as the bracket is confirmed. Kickoff
              times and results are not changed here.
            </p>

            {loading ? (
              <p className="mt-8 text-slate-600">Loading fixtures…</p>
            ) : loadError ? (
              <p className="mt-8 text-red-600">{loadError}</p>
            ) : sections.length === 0 ? (
              <p className={`mt-8 ${worldCupEmptyStateBoxClass}`}>
                No knockout fixtures found for the current season. Knockout matches use
                match numbers ≥ 73 or rounds with number ≥ 200 (excluding group-stage rounds).
              </p>
            ) : (
              <div className="mt-8 space-y-10">
                {sections.map((sec) => (
                  <section key={sec.phase}>
                    <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-semibold text-slate-900">
                      {sec.phase}
                    </h2>
                    <div className={worldCupDataTableWrapClass}>
                      <table className="min-w-[880px] w-full divide-y divide-zinc-200 bg-white">
                        <thead className="bg-zinc-50">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Match #
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Phase
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Kickoff (NZ)
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Home
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Away
                            </th>
                            <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                              Save
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {sec.fixtures.map((f) => {
                            const d = drafts[f.id] || { home: "", away: "" };
                            const err = rowErrors[f.id];
                            const saving = savingId === f.id;
                            const savedFlash = flashSavedId === f.id;
                            return (
                              <tr key={f.id} className="align-top hover:bg-zinc-50">
                                <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-zinc-900">
                                  {f.match_number}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-800">
                                  {f.phase}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-800">
                                  {formatKickoffNz(f.kickoff_at)}
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <select
                                    className={selectClass}
                                    value={d.home}
                                    onChange={(e) => setDraft(f.id, "home", e.target.value)}
                                    disabled={saving}
                                    aria-label={`Home team, match ${f.match_number}`}
                                  >
                                    <option value="">TBD</option>
                                    {teams.map((t) => (
                                      <option
                                        key={`h-${f.id}-${t.code}`}
                                        value={t.code}
                                        disabled={Boolean(d.away && t.code === d.away)}
                                      >
                                        {t.name} ({t.code})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-3 text-sm">
                                  <select
                                    className={selectClass}
                                    value={d.away}
                                    onChange={(e) => setDraft(f.id, "away", e.target.value)}
                                    disabled={saving}
                                    aria-label={`Away team, match ${f.match_number}`}
                                  >
                                    <option value="">TBD</option>
                                    {teams.map((t) => (
                                      <option
                                        key={`a-${f.id}-${t.code}`}
                                        value={t.code}
                                        disabled={Boolean(d.home && t.code === d.home)}
                                      >
                                        {t.name} ({t.code})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-sm">
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => saveFixture(f.id)}
                                      className={`${worldCupPrimaryButtonInlineClass} whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                      {saving ? "Saving…" : "Save"}
                                    </button>
                                    {savedFlash && (
                                      <span className="text-xs font-medium text-green-700">
                                        Saved
                                      </span>
                                    )}
                                    {err && (
                                      <span className="max-w-[200px] text-xs text-red-600">
                                        {err}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
