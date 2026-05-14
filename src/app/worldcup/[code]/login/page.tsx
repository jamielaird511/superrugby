"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAuthInputClass,
  worldCupAuthPageContentShellClass,
  worldCupContentCardClass,
  worldCupPrimaryButtonClass,
  worldCupSecondaryOutlineButtonClass,
  worldCupTertiaryLinkChipClass,
} from "@/lib/worldCupBranding";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";
import { writeWorldCupParticipantId } from "@/lib/worldCupStorage";

export default function FifaWorldCupTenantLoginPage() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : "";
  const tenant = useMemo(() => resolveWorldCupTenant(code), [code]);

  if (!tenant) {
    notFound();
  }

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!tenant) return;
    const src =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("src")
        : null;
    track("landing_view", {
      metadata: {
        src,
        page: "worldcup_login",
        tenant: tenant.slug,
        competitionId: tenant.competitionId,
      },
    });
  }, [tenant]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setMessage(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setMessage("Invalid email or password");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/worldcup/login?tenant=${tenant.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: tenant.slug,
          email: trimmedEmail,
          password,
        }),
      });

      const data = (await response.json()) as {
        participantId?: string;
        team_name?: string | null;
        error?: string;
      };
      if (!response.ok || !data.participantId) {
        setMessage(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      track("login_success", {
        participantId: data.participantId,
        metadata: {
          page: "worldcup_login",
          tenant: tenant.slug,
          competitionId: tenant.competitionId,
        },
      });

      writeWorldCupParticipantId(tenant.slug, data.participantId);
      router.push(`/worldcup/${tenant.slug}/team/${data.participantId}`);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage("Invalid email or password");
      setLoading(false);
    }
  };

  if (!tenant) return null;

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader tenantSlug={tenant.slug} />

      <div className="flex min-h-screen flex-col">
        <div className={`${worldCupAuthPageContentShellClass} flex flex-1 flex-col items-center`}>
          <div className="w-full max-w-md">
            <div className={worldCupContentCardClass}>
              <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-amber-700">
                {tenant.displayName}
              </div>
              <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                Picks login
              </h1>
              <p className="mb-6 text-center text-sm text-slate-500">
                Sign in with the email and password you registered with.
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="login-email">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={worldCupAuthInputClass}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="login-password">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={worldCupAuthInputClass}
                    required
                  />
                </div>

                {message && <div className="text-sm text-red-600">{message}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className={worldCupPrimaryButtonClass}
                >
                  {loading ? "Logging in…" : "Log in"}
                </button>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <Link
                  href={`/worldcup/${tenant.slug}/register`}
                  className={worldCupSecondaryOutlineButtonClass}
                >
                  Create an account
                </Link>
              </div>

              <div className="mt-6 flex justify-center">
                <Link
                  href="/worldcup/admin/login"
                  className={worldCupTertiaryLinkChipClass}
                >
                  Admin login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
