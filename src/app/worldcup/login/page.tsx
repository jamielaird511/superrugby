"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupAuthInputClass,
  worldCupAuthPageContentShellClass,
  worldCupContentCardClass,
  worldCupFormAlertErrorClass,
  worldCupPrimaryButtonClass,
  worldCupSecondaryOutlineButtonClass,
  worldCupTertiaryLinkChipClass,
} from "@/lib/worldCupBranding";
import { writeWorldCupParticipantId } from "@/lib/worldCupStorage";

type CompetitionLoginOption = {
  tenantSlug: string;
  displayName: string;
  participantId: string;
  teamName: string;
};

export default function WorldCupPublicLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [competitionOptions, setCompetitionOptions] = useState<CompetitionLoginOption[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    const src =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("src") : null;
    track("landing_view", {
      metadata: {
        src,
        page: "worldcup_public_login",
      },
    });
  }, []);

  function completeLogin(tenantSlug: string, participantId: string) {
    writeWorldCupParticipantId(tenantSlug, participantId);
    router.push(`/worldcup/${tenantSlug}/team/${participantId}`);
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setCompetitionOptions(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        setMessage("Invalid email or password");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/worldcup/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = (await response.json()) as {
        participantId?: string;
        team_name?: string | null;
        tenant?: string;
        requiresCompetitionSelection?: boolean;
        options?: CompetitionLoginOption[];
        error?: string;
      };

      if (!response.ok) {
        setMessage(data.error || "Invalid email or password");
        setLoading(false);
        return;
      }

      if (data.requiresCompetitionSelection && data.options && data.options.length > 0) {
        setCompetitionOptions(data.options);
        setLoading(false);
        return;
      }

      if (!data.participantId || !data.tenant) {
        setMessage("Invalid email or password");
        setLoading(false);
        return;
      }

      track("login_success", {
        participantId: data.participantId,
        metadata: {
          page: "worldcup_public_login",
          tenant: data.tenant,
        },
      });

      completeLogin(data.tenant, data.participantId);
    } catch (err) {
      console.error("Unexpected error:", err);
      setMessage("Invalid email or password");
      setLoading(false);
    }
  };

  function handleChooseCompetition(opt: CompetitionLoginOption) {
    setCompetitionOptions(null);
    track("login_success", {
      participantId: opt.participantId,
      metadata: {
        page: "worldcup_public_login",
        tenant: opt.tenantSlug,
        competitionChoice: true,
      },
    });
    completeLogin(opt.tenantSlug, opt.participantId);
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader />

      <div className="flex min-h-screen flex-col">
        <div className={`${worldCupAuthPageContentShellClass} flex flex-1 flex-col items-center`}>
          <div className="w-full max-w-md">
            <div className={worldCupContentCardClass}>
              <p className="mb-3 text-center text-xs leading-snug text-slate-500 sm:mb-4 sm:text-sm">
                <a
                  href="https://superrugby.vercel.app/worldcup/login"
                  className="font-medium text-[#126BFF] underline decoration-[#126BFF]/30 underline-offset-2 hover:text-[#0f5fdf]"
                >
                  Having trouble loading? Open the app here
                </a>
              </p>
              <h1 className="mb-1 text-center text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                World Cup — Log In
              </h1>
              <p className="mb-6 text-center text-sm text-slate-500">
                Sign in with the email and password you registered with.
              </p>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="wc-pub-login-email">
                    Email
                  </label>
                  <input
                    id="wc-pub-login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={worldCupAuthInputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="wc-pub-login-password"
                  >
                    Password
                  </label>
                  <input
                    id="wc-pub-login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={worldCupAuthInputClass}
                    required
                  />
                </div>

                {message ? <p className={worldCupFormAlertErrorClass}>{message}</p> : null}

                <button type="submit" disabled={loading} className={worldCupPrimaryButtonClass}>
                  {loading ? "Logging in…" : "Log In"}
                </button>
              </form>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <Link href="/worldcup/register" className={worldCupSecondaryOutlineButtonClass}>
                  Create an Account
                </Link>
              </div>

              <div className="mt-6 flex justify-center">
                <Link href="/worldcup/admin/login" className={worldCupTertiaryLinkChipClass}>
                  Admin Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {competitionOptions ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4 py-6"
          role="presentation"
          onClick={() => setCompetitionOptions(null)}
        >
          <div
            className={`${worldCupContentCardClass} w-full max-w-md shadow-md`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wc-comp-select-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="wc-comp-select-title" className="text-center text-base font-semibold text-slate-900">
              Choose Competition
            </h2>
            <p className="mt-2 text-center text-xs text-slate-600">
              Your account is in more than one World Cup competition. Pick which one to open.
            </p>
            <ul className="mt-4 flex max-h-[min(60vh,22rem)] flex-col gap-2 overflow-y-auto">
              {competitionOptions.map((opt) => (
                <li key={`${opt.tenantSlug}-${opt.participantId}`}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:border-[#126BFF] hover:bg-slate-50"
                    onClick={() => handleChooseCompetition(opt)}
                  >
                    <span className="block font-semibold text-slate-900">{opt.displayName}</span>
                    {opt.teamName ? (
                      <span className="mt-0.5 block text-xs text-slate-600">{opt.teamName}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => setCompetitionOptions(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
