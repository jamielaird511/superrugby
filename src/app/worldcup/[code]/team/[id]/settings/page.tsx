"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAuthInputClass,
  worldCupContentCardClass,
  worldCupFormAlertErrorClass,
  worldCupFormAlertSuccessClass,
  worldCupMainContentShellClass,
  worldCupPrimaryButtonInlineClass,
  worldCupSectionPanelClass,
} from "@/lib/worldCupBranding";
import {
  WORLD_CUP_PARTICIPANT_UPDATED_EVENT,
  worldCupParticipantSubtitle,
  type WorldCupParticipantUpdatedDetail,
} from "@/lib/worldCupParticipantDisplay";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";
import { readWorldCupParticipantId } from "@/lib/worldCupStorage";

export default function WorldCupParticipantSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const routeParticipantId = (params?.id as string) || "";
  const code = typeof params?.code === "string" ? params.code : "";
  const tenant = useMemo(() => resolveWorldCupTenant(code), [code]);
  if (!tenant) notFound();
  const tenantPrefix = tenant ? `/worldcup/${tenant.slug}` : "/worldcup";

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");

  const [nameSaving, setNameSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [nameMessage, setNameMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    (async () => {
      const storedId = readWorldCupParticipantId(tenant.slug);
      if (!storedId || storedId !== routeParticipantId) {
        router.replace(`${tenantPrefix}/login`);
        return;
      }

      try {
        const res = await fetch(
          `/api/worldcup/participant/settings?participantId=${encodeURIComponent(
            routeParticipantId
          )}&tenant=${tenant.slug}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as {
          participant?: { id: string; name: string; team_name: string };
          error?: string;
        };
        if (!res.ok || !json.participant) {
          if (!cancelled) {
            setNameMessage({
              type: "err",
              text: json.error || "Failed to load participant settings.",
            });
          }
          return;
        }
        if (!cancelled) {
          const nextName = (json.participant.team_name || "").trim();
          setDisplayName(nextName);
          setLegalName((json.participant.name || "").trim());
        }
      } catch {
        if (!cancelled) {
          setNameMessage({ type: "err", text: "Failed to load participant settings." });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeParticipantId, router, tenant, tenantPrefix]);

  async function saveDisplayName() {
    if (!tenant) return;
    const next = displayName.trim();
    if (!next) {
      setNameMessage({ type: "err", text: "Display name is required." });
      return;
    }
    setNameMessage(null);
    setNameSaving(true);
    try {
      const res = await fetch(`/api/worldcup/participant/settings?tenant=${tenant.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: routeParticipantId,
          displayName: next,
          tenant: tenant.slug,
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setNameMessage({ type: "err", text: json.error || "Failed to update display name." });
        return;
      }
      setNameMessage({ type: "ok", text: json.message || "Display name updated." });
      window.dispatchEvent(
        new CustomEvent<WorldCupParticipantUpdatedDetail>(WORLD_CUP_PARTICIPANT_UPDATED_EVENT, {
          detail: { participantId: routeParticipantId, team_name: next },
        })
      );
      router.refresh();
    } catch {
      setNameMessage({ type: "err", text: "Failed to update display name." });
    } finally {
      setNameSaving(false);
    }
  }

  async function savePassword() {
    if (!tenant) return;
    setPasswordMessage(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMessage({ type: "err", text: "All password fields are required." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "err", text: "New passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch(`/api/worldcup/participant/settings?tenant=${tenant.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: routeParticipantId,
          currentPassword,
          newPassword,
          confirmNewPassword,
          tenant: tenant.slug,
        }),
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setPasswordMessage({ type: "err", text: json.error || "Failed to update password." });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMessage({ type: "ok", text: json.message || "Password updated." });
    } catch {
      setPasswordMessage({ type: "err", text: "Failed to update password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (!tenant) return null;

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader
        subtitle={
          loading
            ? "Settings"
            : worldCupParticipantSubtitle({ name: legalName, team_name: displayName })
        }
        initialParticipantId={routeParticipantId}
        tenantSlug={tenant.slug}
      />

      <main className="w-full">
        <div className={worldCupMainContentShellClass}>
          <div className={worldCupContentCardClass}>
            <h1 className="text-2xl font-semibold text-[#003A5D]">Participant Settings</h1>
            <p className="mt-2 text-sm text-slate-600">
              Update your World Cup display name and password.
            </p>

            {loading ? (
              <p className="mt-8 text-slate-600">Loading settings…</p>
            ) : (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Display Name</h2>
                  <p className="mt-1 text-sm text-zinc-600">Shown on leaderboard and picks pages.</p>
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-zinc-800" htmlFor="display-name">
                      Team / Display Name
                    </label>
                    <input
                      id="display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className={worldCupAuthInputClass}
                      placeholder="Enter display name"
                    />
                    {nameMessage ? (
                      <p className={nameMessage.type === "ok" ? worldCupFormAlertSuccessClass : worldCupFormAlertErrorClass}>
                        {nameMessage.text}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={nameSaving}
                      onClick={saveDisplayName}
                      className={worldCupPrimaryButtonInlineClass}
                    >
                      {nameSaving ? "Saving…" : "Save Display Name"}
                    </button>
                  </div>
                </section>

                <section className={worldCupSectionPanelClass}>
                  <h2 className="text-base font-semibold text-zinc-900">Change Password</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Enter your current password to set a new password.
                  </p>
                  <div className="mt-4 space-y-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={worldCupAuthInputClass}
                      placeholder="Current password"
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={worldCupAuthInputClass}
                      placeholder="New password"
                    />
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className={worldCupAuthInputClass}
                      placeholder="Confirm new password"
                    />
                    {passwordMessage ? (
                      <p
                        className={
                          passwordMessage.type === "ok"
                            ? worldCupFormAlertSuccessClass
                            : worldCupFormAlertErrorClass
                        }
                      >
                        {passwordMessage.text}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={passwordSaving}
                      onClick={savePassword}
                      className={worldCupPrimaryButtonInlineClass}
                    >
                      {passwordSaving ? "Saving…" : "Update Password"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
