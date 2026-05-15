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
  worldCupModalPanelClass,
  worldCupPrimaryButtonInlineClass,
  worldCupSelectControlClass,
} from "@/lib/worldCupBranding";
import { listWorldCupTenants, WORLD_CUP_DEFAULT_TENANT_SLUG } from "@/lib/worldCupIds";

type ParticipantRow = {
  id: string;
  playerName: string;
  email: string | null;
  joinedAt: string;
  matchPicksCount: number;
  competitionPicksCompleted: number;
  competitionPicksTotal: number;
};

function formatJoinedNz(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WorldCupAdminParticipantsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [tenantSlug, setTenantSlug] = useState<string>(WORLD_CUP_DEFAULT_TENANT_SLUG);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmResetParticipant, setConfirmResetParticipant] = useState<ParticipantRow | null>(
    null
  );
  const [tempPasswordModal, setTempPasswordModal] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const confirmPrimaryRef = useRef<HTMLButtonElement>(null);
  const successCopyRef = useRef<HTMLButtonElement>(null);

  const tenants = listWorldCupTenants();

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

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setLoadError("Not signed in");
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/worldcup/admin/participants?tenant=${encodeURIComponent(tenantSlug)}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const json = (await res.json()) as {
        error?: string;
        participants?: ParticipantRow[];
      };
      if (!res.ok) {
        setLoadError(json?.error || `Request failed (${res.status})`);
        setParticipants([]);
        return;
      }
      setParticipants(Array.isArray(json.participants) ? json.participants : []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      await loadParticipants();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, loadParticipants]);

  function closePasswordModal() {
    setTempPasswordModal(null);
    setCopyFlash(false);
  }

  useEffect(() => {
    if (confirmResetParticipant && !tempPasswordModal) {
      confirmPrimaryRef.current?.focus();
    }
  }, [confirmResetParticipant, tempPasswordModal]);

  useEffect(() => {
    if (tempPasswordModal) {
      successCopyRef.current?.focus();
    }
  }, [tempPasswordModal]);

  useEffect(() => {
    if (!confirmResetParticipant && !tempPasswordModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (resettingId) return;
      e.preventDefault();
      if (tempPasswordModal) {
        setTempPasswordModal(null);
        setCopyFlash(false);
      } else {
        setConfirmResetParticipant(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmResetParticipant, tempPasswordModal, resettingId]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setAllowed(false);
    router.replace("/worldcup/login");
  }

  function openResetConfirm(row: ParticipantRow) {
    setActionError(null);
    setConfirmResetParticipant(row);
  }

  function closeResetConfirm() {
    if (resettingId) return;
    setConfirmResetParticipant(null);
  }

  async function executeResetPasswordFromModal() {
    const row = confirmResetParticipant;
    if (!row || resettingId) return;

    setActionError(null);
    setResettingId(row.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setActionError("Session expired; sign in again.");
        return;
      }

      const res = await fetch("/api/worldcup/admin/participants/reset-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenant: tenantSlug, participantId: row.id }),
      });
      const json = (await res.json()) as { error?: string; temporaryPassword?: string };
      if (!res.ok || !json.temporaryPassword) {
        setActionError(json?.error || "Unable to reset password");
        return;
      }
      setConfirmResetParticipant(null);
      setTempPasswordModal(json.temporaryPassword);
    } catch {
      setActionError("Unable to reset password");
    } finally {
      setResettingId(null);
    }
  }

  async function copyPassword() {
    if (!tempPasswordModal) return;
    try {
      await navigator.clipboard.writeText(tempPasswordModal);
      setCopyFlash(true);
      window.setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      setActionError("Could not copy to clipboard");
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
      <WorldCupAdminHeader subtitle="Admin — participants" onLogout={handleLogout} />

      {confirmResetParticipant && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wc-reset-confirm-title"
          aria-busy={!!resettingId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close dialog"
            disabled={!!resettingId}
            onClick={closeResetConfirm}
          />
          <div
            className={`${worldCupModalPanelClass} relative z-10 max-w-md border-2 border-zinc-300 shadow-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="wc-reset-confirm-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Reset password?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              A new temporary password will be created for this participant.
            </p>
            <dl className="mt-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 font-medium text-zinc-600">Name</dt>
                <dd className="min-w-0 font-medium text-slate-900">{confirmResetParticipant.playerName}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 font-medium text-zinc-600">Email</dt>
                <dd className="min-w-0 break-all text-slate-900">
                  {confirmResetParticipant.email || "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={!!resettingId}
                onClick={closeResetConfirm}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                ref={confirmPrimaryRef}
                type="button"
                disabled={!!resettingId}
                onClick={executeResetPasswordFromModal}
                className={`${worldCupPrimaryButtonInlineClass} disabled:cursor-not-allowed disabled:opacity-50`}
                aria-busy={resettingId === confirmResetParticipant.id}
              >
                {resettingId === confirmResetParticipant.id
                  ? "Generating…"
                  : "Generate temporary password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tempPasswordModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wc-temp-password-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close dialog"
            onClick={closePasswordModal}
          />
          <div
            className={`${worldCupModalPanelClass} relative z-10 max-w-md border-2 border-zinc-300 shadow-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="wc-temp-password-title"
              className="text-lg font-semibold tracking-tight text-slate-900"
            >
              Temporary password created
            </h2>
            <div className="mt-4 rounded-md border-2 border-zinc-300 bg-zinc-50 px-3 py-3">
              <p className="font-mono text-sm font-semibold tracking-wide text-slate-900 break-all">
                {tempPasswordModal}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                ref={successCopyRef}
                type="button"
                onClick={copyPassword}
                className={worldCupPrimaryButtonInlineClass}
              >
                {copyFlash ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Ask the participant to log in and change this in Settings.
            </p>
          </div>
        </div>
      )}

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
            <h1 className="text-2xl font-semibold text-slate-900">Participants</h1>
            <p className="mt-2 text-sm text-slate-600">
              View registered players for a competition and reset passwords when needed.
            </p>

            <div className="mt-6 max-w-md">
              <label htmlFor="wc-admin-tenant" className="block text-sm font-medium text-slate-800">
                Competition
              </label>
              <select
                id="wc-admin-tenant"
                className={`mt-1.5 ${worldCupSelectControlClass} max-w-md bg-white text-slate-900`}
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
              >
                {tenants.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </div>

            {actionError && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {actionError}
              </p>
            )}

            {loading ? (
              <p className="mt-8 text-slate-600">Loading participants…</p>
            ) : loadError ? (
              <p className="mt-8 text-red-600">{loadError}</p>
            ) : participants.length === 0 ? (
              <p className={`mt-8 ${worldCupEmptyStateBoxClass}`}>
                No participants found for this competition.
              </p>
            ) : (
              <div className="mt-8">
                <div className={worldCupDataTableWrapClass}>
                  <table className="min-w-[720px] w-full divide-y divide-zinc-200 bg-white">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Player name
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Email
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Joined
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Match picks
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Competition picks
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {participants.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-50">
                          <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-zinc-900">
                            {p.playerName}
                          </td>
                          <td className="max-w-[220px] truncate px-3 py-3 text-sm text-zinc-800">
                            {p.email || "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-800">
                            {formatJoinedNz(p.joinedAt)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center text-sm tabular-nums text-zinc-900">
                            {p.matchPicksCount}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center text-sm tabular-nums text-zinc-900">
                            {p.competitionPicksCompleted}/{p.competitionPicksTotal}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm">
                            <button
                              type="button"
                              disabled={
                                !!resettingId || !!confirmResetParticipant || !!tempPasswordModal
                              }
                              onClick={() => openResetConfirm(p)}
                              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Reset password
                            </button>
                          </td>
                        </tr>
                      ))}
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
