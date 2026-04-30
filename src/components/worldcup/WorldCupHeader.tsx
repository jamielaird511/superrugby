"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "worldcup_participant_id";

type Props = {
  subtitle?: string;
  initialParticipantId?: string | null;
};

export default function WorldCupHeader({ subtitle, initialParticipantId = null }: Props) {
  const pathname = usePathname();
  const [participantId, setParticipantId] = useState<string | null>(initialParticipantId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem(STORAGE_KEY);
    setParticipantId(id || initialParticipantId || null);
  }, [initialParticipantId]);

  const activeTab: "picks" | "results" | "settings" = useMemo(() => {
    if (pathname?.startsWith("/worldcup/team/") && pathname.endsWith("/settings")) return "settings";
    if (pathname === "/worldcup/results") return "results";
    return "picks";
  }, [pathname]);

  const picksHref = participantId ? `/worldcup/team/${participantId}` : null;
  const settingsHref = participantId ? `/worldcup/team/${participantId}/settings` : null;

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/worldcup/login";
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-[#004765] shadow-md">
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xl font-bold uppercase tracking-wide text-white">
              FIFA World Cup 2026
            </span>
            {subtitle ? (
              <span className="truncate text-sm font-medium text-white/80">{subtitle}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {picksHref ? (
              <Link
                href={picksHref}
                className={
                  activeTab === "picks"
                    ? "rounded-full border border-white/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#004765]"
                    : "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
                }
              >
                Picks
              </Link>
            ) : (
              <Link
                href="/worldcup/login"
                className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              >
                Log in
              </Link>
            )}

            <Link
              href="/worldcup/results"
              className={
                activeTab === "results"
                  ? "rounded-full border border-white/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#004765]"
                  : "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              }
            >
              Results
            </Link>

            {settingsHref ? (
              <Link
                href={settingsHref}
                className={
                  activeTab === "settings"
                    ? "rounded-full border border-white/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#004765]"
                    : "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
                }
              >
                Settings
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/70"
              >
                Settings
              </button>
            )}

            {participantId ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Log out
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

