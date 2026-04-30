"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FixtureRow = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  winning_team: string | null;
  margin_band: string | null;
  home_score: number | null;
  away_score: number | null;
};

type RoundSection = {
  id: string;
  label: string;
  season: number;
  round_number: number;
  fixtures: FixtureRow[];
};

function teamLabel(code: string, teamNames: Record<string, string>) {
  return teamNames[code.trim().toUpperCase()] || code;
}

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

export default function WorldCupAdminResultsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rounds, setRounds] = useState<RoundSection[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [clearModalFixture, setClearModalFixture] = useState<FixtureRow | null>(null);
  const [flashSavedId, setFlashSavedId] = useState<string | null>(null);
  const flashSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const applyPayload = useCallback(
    (payload: { rounds: RoundSection[]; teamNames: Record<string, string> }) => {
      setRounds(payload.rounds);
      setTeamNames(payload.teamNames || {});
      const next: Record<string, { home: string; away: string }> = {};
      for (const r of payload.rounds) {
        for (const f of r.fixtures) {
          next[f.id] = {
            home:
              f.home_score !== null && f.home_score !== undefined
                ? String(f.home_score)
                : "",
            away:
              f.away_score !== null && f.away_score !== undefined
                ? String(f.away_score)
                : "",
          };
        }
      }
      setDrafts(next);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;

      if (userError || !user) {
        router.replace("/worldcup/login");
        setAuthChecked(true);
        return;
      }

      const envString = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
      const adminEmails = envString?.split(",").map((e) => e.trim().toLowerCase()) || [];
      const userEmailLower = user.email?.toLowerCase() || "";
      const ok =
        adminEmails.length > 0 && userEmailLower && adminEmails.includes(userEmailLower);

      if (!ok) {
        router.replace("/");
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

        const res = await fetch("/api/worldcup/admin/results", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { error?: string; rounds?: RoundSection[] };
        if (!res.ok) {
          const msg =
            json?.error ||
            (res.status ? `Request failed (${res.status})` : "Failed to load data");
          setLoadError(msg);
          setLoading(false);
          return;
        }
        applyPayload(json as { rounds: RoundSection[]; teamNames: Record<string, string> });
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

  useEffect(() => {
    return () => {
      if (flashSavedTimerRef.current) clearTimeout(flashSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!clearModalFixture) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClearModalFixture(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearModalFixture]);

  async function saveFixture(fixtureId: string) {
    setSaveMessage(null);
    const d = drafts[fixtureId];
    if (!d) return;

    const hg = parseInt(d.home, 10);
    const ag = parseInt(d.away, 10);
    if (!Number.isFinite(hg) || !Number.isFinite(ag)) {
      setSaveMessage({ type: "err", text: "Enter numeric scores for both teams." });
      return;
    }

    setSavingId(fixtureId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setSaveMessage({ type: "err", text: "Session expired; sign in again." });
        return;
      }

      const res = await fetch("/api/worldcup/admin/results", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fixture_id: fixtureId,
          home_score: hg,
          away_score: ag,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMessage({ type: "err", text: json?.error || "Save failed" });
        return;
      }

      const updated = json?.result as {
        winning_team?: string;
        margin_band?: string | null;
        home_score?: number | null;
        away_score?: number | null;
      };

      setRounds((prev) =>
        prev.map((round) => ({
          ...round,
          fixtures: round.fixtures.map((f) =>
            f.id === fixtureId
              ? {
                  ...f,
                  winning_team: updated?.winning_team ?? f.winning_team,
                  margin_band: updated?.margin_band ?? null,
                  home_score: updated?.home_score ?? hg,
                  away_score: updated?.away_score ?? ag,
                }
              : f
          ),
        }))
      );

      setDrafts((prev) => ({
        ...prev,
        [fixtureId]: {
          home: String(updated?.home_score ?? hg),
          away: String(updated?.away_score ?? ag),
        },
      }));

      setSaveMessage({ type: "ok", text: "Result saved." });
      if (flashSavedTimerRef.current) clearTimeout(flashSavedTimerRef.current);
      setFlashSavedId(fixtureId);
      flashSavedTimerRef.current = setTimeout(() => {
        setFlashSavedId(null);
        flashSavedTimerRef.current = null;
      }, 2500);
    } catch {
      setSaveMessage({ type: "err", text: "Save failed" });
    } finally {
      setSavingId(null);
    }
  }

  async function executeClearSavedResult() {
    const fixtureId = clearModalFixture?.id;
    if (!fixtureId) return;

    setClearModalFixture(null);
    setSaveMessage(null);
    setClearingId(fixtureId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setSaveMessage({ type: "err", text: "Session expired; sign in again." });
        return;
      }

      const res = await fetch(
        `/api/worldcup/admin/results?fixture_id=${encodeURIComponent(fixtureId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSaveMessage({ type: "err", text: json?.error || "Clear failed" });
        return;
      }

      setRounds((prev) =>
        prev.map((round) => ({
          ...round,
          fixtures: round.fixtures.map((f) =>
            f.id === fixtureId
              ? {
                  ...f,
                  winning_team: null,
                  margin_band: null,
                  home_score: null,
                  away_score: null,
                }
              : f
          ),
        }))
      );

      setDrafts((prev) => ({
        ...prev,
        [fixtureId]: { home: "", away: "" },
      }));

      if (flashSavedId === fixtureId) setFlashSavedId(null);

      setSaveMessage({ type: "ok", text: "Result cleared." });
    } catch {
      setSaveMessage({ type: "err", text: "Clear failed" });
    } finally {
      setClearingId(null);
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Checking access…
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-sky-50 font-sans text-slate-900">
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-[#004765] shadow-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xl font-bold uppercase tracking-wide text-white">
              FIFA World Cup 2026
            </span>
            <span className="text-sm font-medium text-white/80">Admin — results</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/worldcup/results"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Public results
            </Link>
            <Link
              href="/"
              className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {clearModalFixture && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wc-clear-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close dialog"
            onClick={() => setClearModalFixture(null)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="wc-clear-modal-title"
              className="text-lg font-semibold text-[#003A5D]"
            >
              Clear saved result?
            </h2>
            <p className="mt-3 text-sm text-slate-800">
              <span className="font-medium">
                {teamLabel(clearModalFixture.home_team_code, teamNames)}
              </span>
              <span className="text-slate-500"> vs </span>
              <span className="font-medium">
                {teamLabel(clearModalFixture.away_team_code, teamNames)}
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The saved score for this match will be removed from the database and the score
              fields will be reset. This does not delete the fixture.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearModalFixture(null)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeClearSavedResult}
                disabled={clearingId === clearModalFixture.id}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {clearingId === clearModalFixture.id ? "Clearing…" : "Clear result"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 pb-12 pt-28 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-[#003A5D]">Enter match scores</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter full-time scores (home and away). The winner is derived from the scores (home
            team code, away team code, or DRAW). Rugby margin bands are not used.
          </p>

          {saveMessage && (
            <p
              className={`mt-4 text-sm ${saveMessage.type === "ok" ? "text-green-700" : "text-red-600"}`}
            >
              {saveMessage.text}
            </p>
          )}

          {loading ? (
            <p className="mt-8 text-slate-600">Loading fixtures…</p>
          ) : loadError ? (
            <p className="mt-8 text-red-600">{loadError}</p>
          ) : rounds.length === 0 ? (
            <p className="mt-8 rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
              No World Cup fixtures found for the current season.
            </p>
          ) : (
            <div className="mt-8 space-y-10">
              {rounds.map((round) => (
                <section key={round.id}>
                  <h2 className="mb-4 border-b border-zinc-200 pb-2 text-lg font-semibold text-[#003A5D]">
                    {round.label}
                  </h2>
                  <div className="overflow-x-auto rounded-md border border-zinc-300">
                    <table className="min-w-full divide-y divide-zinc-200 bg-white">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            #
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            Fixture
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            Kickoff (NZ)
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            Home score
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            Away score
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {round.fixtures.map((f) => {
                          const draft = drafts[f.id] ?? { home: "", away: "" };
                          const hasSavedScores =
                            f.home_score !== null &&
                            f.home_score !== undefined &&
                            f.away_score !== null &&
                            f.away_score !== undefined;
                          return (
                            <tr
                              key={f.id}
                              className={
                                hasSavedScores
                                  ? "border-l-[3px] border-l-sky-400 bg-sky-50/90 hover:bg-sky-100/90"
                                  : "hover:bg-zinc-50"
                              }
                            >
                              <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-900">
                                {f.match_number}
                              </td>
                              <td className="px-3 py-3 text-sm text-zinc-900">
                                <span className="font-medium">
                                  {teamLabel(f.home_team_code, teamNames)}
                                </span>
                                <span className="text-zinc-500"> vs </span>
                                <span className="font-medium">
                                  {teamLabel(f.away_team_code, teamNames)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-600">
                                {formatKickoffNz(f.kickoff_at)}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  inputMode="numeric"
                                  className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-center text-sm"
                                  value={draft.home}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [f.id]: { ...draft, home: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={50}
                                  inputMode="numeric"
                                  className="w-20 rounded border border-zinc-300 px-2 py-1.5 text-center text-sm"
                                  value={draft.away}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [f.id]: { ...draft, away: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingId === f.id || clearingId === f.id}
                                    onClick={() => saveFixture(f.id)}
                                    className="rounded-md bg-[#004765] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#00354d] disabled:opacity-50"
                                  >
                                    {savingId === f.id ? "Saving…" : "Save"}
                                  </button>
                                  {hasSavedScores && (
                                    <button
                                      type="button"
                                      disabled={savingId === f.id || clearingId === f.id}
                                      onClick={() => setClearModalFixture(f)}
                                      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                                    >
                                      {clearingId === f.id ? "Clearing…" : "Clear"}
                                    </button>
                                  )}
                                  {flashSavedId === f.id && (
                                    <span className="text-xs font-medium text-sky-700">
                                      Saved
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
      </main>
    </div>
  );
}
