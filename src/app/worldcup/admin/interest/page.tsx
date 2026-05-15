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
  worldCupTableThClass,
} from "@/lib/worldCupBranding";

type Submission = {
  id: string;
  name: string;
  email: string;
  competition_idea: string | null;
  created_at: string;
  status: string;
};

const STATUS_OPTIONS = ["new", "contacted", "archived"] as const;

function formatDateNz(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WorldCupAdminInterestPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowFlash, setRowFlash] = useState<string | null>(null);
  const submissionsRef = useRef<Submission[]>([]);

  useEffect(() => {
    submissionsRef.current = submissions;
  }, [submissions]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setLoadError("Not signed in");
        setSubmissions([]);
        return;
      }

      const res = await fetch("/api/worldcup/admin/interest", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as { error?: string; submissions?: Submission[] };
      if (!res.ok) {
        setLoadError(json?.error || `Request failed (${res.status})`);
        setSubmissions([]);
        return;
      }
      const list = Array.isArray(json.submissions) ? json.submissions : [];
      setSubmissions(list);
      const drafts: Record<string, string> = {};
      for (const s of list) {
        drafts[s.id] = s.status;
      }
      setStatusDrafts(drafts);
      setPatchError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
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
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    loadSubmissions();
  }, [allowed, loadSubmissions]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAllowed(false);
    router.replace("/worldcup/login");
  }

  async function saveStatus(id: string) {
    const next = statusDrafts[id];
    if (!next) return;
    setSavingId(id);
    setPatchError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/worldcup/admin/interest", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setPatchError(json?.error || "Failed to update status");
        const serverStatus =
          submissionsRef.current.find((s) => s.id === id)?.status ?? "new";
        setStatusDrafts((prev) => ({ ...prev, [id]: serverStatus }));
        return;
      }
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: next } : s))
      );
      setRowFlash(id);
      window.setTimeout(() => setRowFlash((cur) => (cur === id ? null : cur)), 2000);
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

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupAdminHeader subtitle="Admin — interest" onLogout={handleLogout} />

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
            <h1 className="text-2xl font-semibold text-slate-900">PaperPunter interest</h1>
            <p className="mt-2 text-sm text-slate-600">
              Submissions from the &quot;Register interest&quot; form on the create competition page.
            </p>

            {patchError && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {patchError}
              </p>
            )}

            {loadError && !loading && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {loadError}
              </p>
            )}

            {loading ? (
              <p className="mt-8 text-slate-600">Loading…</p>
            ) : submissions.length === 0 ? (
              <p className={`mt-8 ${worldCupEmptyStateBoxClass}`}>No submissions yet.</p>
            ) : (
              <div className="mt-8">
                <div className={worldCupDataTableWrapClass}>
                  <table className="min-w-[900px] w-full divide-y divide-zinc-200 bg-white">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className={`whitespace-nowrap ${worldCupTableThClass} text-left`}>
                          Date
                        </th>
                        <th className={`whitespace-nowrap ${worldCupTableThClass} text-left`}>
                          Name
                        </th>
                        <th className={`whitespace-nowrap ${worldCupTableThClass} text-left`}>
                          Email
                        </th>
                        <th className={`${worldCupTableThClass} text-left`}>
                          Competition Idea
                        </th>
                        <th className={`whitespace-nowrap ${worldCupTableThClass} text-left`}>
                          Status
                        </th>
                        <th className={`whitespace-nowrap ${worldCupTableThClass} text-left`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {submissions.map((s) => {
                        const draft = statusDrafts[s.id] ?? s.status;
                        const dirty = draft !== s.status;
                        const saving = savingId === s.id;
                        return (
                          <tr key={s.id} className="align-top hover:bg-zinc-50">
                            <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-800">
                              {formatDateNz(s.created_at)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-zinc-900">
                              {s.name}
                            </td>
                            <td className="max-w-[200px] break-all px-3 py-3 text-sm text-zinc-800">
                              {s.email}
                            </td>
                            <td className="max-w-md px-3 py-3 text-sm text-zinc-800">
                              {s.competition_idea || "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-sm">
                              <select
                                className={`${worldCupSelectControlClass} w-[140px] bg-white text-sm`}
                                value={draft}
                                disabled={saving}
                                onChange={(e) =>
                                  setStatusDrafts((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }))
                                }
                                aria-label={`Status for ${s.name}`}
                              >
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-sm">
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  className={worldCupPrimaryButtonInlineClass}
                                  disabled={saving || !dirty}
                                  onClick={() => saveStatus(s.id)}
                                >
                                  {saving ? "Saving…" : "Save Status"}
                                </button>
                                {rowFlash === s.id && (
                                  <span className="text-xs font-medium text-green-700">Saved</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
