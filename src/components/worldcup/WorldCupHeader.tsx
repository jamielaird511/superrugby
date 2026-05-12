"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import PaperPunterBrandStrip from "@/components/paperpunter/PaperPunterBrandStrip";

const STORAGE_KEY = "worldcup_participant_id";

const pillActive =
  "rounded-lg border border-white/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#126BFF]";
const pillIdle =
  "rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20";

const pillCompetitionIncompleteIdle =
  "rounded-lg border border-orange-300 bg-orange-100 px-3 py-1.5 text-sm font-medium text-orange-800 hover:bg-orange-200/90";
const pillCompetitionIncompleteActive =
  "rounded-lg border-2 border-white bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-900 shadow-sm";

export type WorldCupCompetitionPicksCompletion = { completed: number; total: number };

function isCompetitionPicksIncomplete(completion: WorldCupCompetitionPicksCompletion | null | undefined) {
  if (!completion || completion.total <= 0) return false;
  return completion.completed < completion.total;
}

type Props = {
  subtitle?: string;
  initialParticipantId?: string | null;
  /** When set, drives incomplete styling on the Competition Picks nav item (no extra fetch in the header). */
  competitionPicksCompletion?: WorldCupCompetitionPicksCompletion | null;
};

export default function WorldCupHeader({
  subtitle,
  initialParticipantId = null,
  competitionPicksCompletion = null,
}: Props) {
  const pathname = usePathname();
  const [participantId, setParticipantId] = useState<string | null>(initialParticipantId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem(STORAGE_KEY);
    setParticipantId(id || initialParticipantId || null);
  }, [initialParticipantId]);

  const isLoginPage = pathname === "/worldcup/login";
  const isRegisterPage = pathname === "/worldcup/register";
  const isAuthShell = isLoginPage || isRegisterPage;

  const activeTab: "picks" | "competition-picks" | "results" | "settings" = useMemo(() => {
    if (pathname?.startsWith("/worldcup/team/") && pathname.endsWith("/competition-picks")) {
      return "competition-picks";
    }
    if (pathname?.startsWith("/worldcup/team/") && pathname.endsWith("/settings")) return "settings";
    if (pathname === "/worldcup/results") return "results";
    return "picks";
  }, [pathname]);

  const picksHref = participantId ? `/worldcup/team/${participantId}` : null;
  const competitionPicksHref = participantId
    ? `/worldcup/team/${participantId}/competition-picks`
    : null;
  const settingsHref = participantId ? `/worldcup/team/${participantId}/settings` : null;

  const competitionPicksIncomplete = isCompetitionPicksIncomplete(competitionPicksCompletion);

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/worldcup/login";
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden shadow-[0_6px_20px_rgba(15,23,42,0.12)]">
      <PaperPunterBrandStrip />
      <nav
        aria-label={isAuthShell ? "World Cup account" : "World Cup"}
        className="w-full border-b border-[#0d52d4] bg-[#126BFF] text-white"
      >
        {isAuthShell ? (
          <div className="flex w-full flex-wrap items-center justify-end gap-2 px-4 py-2 sm:px-6 sm:py-2.5">
            <Link
              href="/paperpunter"
              className="rounded-md border border-white/35 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10 sm:text-sm"
            >
              Home
            </Link>
            {isLoginPage ? (
              <Link
                href="/worldcup/register"
                className="rounded-md border-2 border-white bg-white px-3 py-1.5 text-[13px] font-semibold text-[#126BFF] shadow-sm transition-colors hover:bg-white/95 sm:text-sm"
              >
                Register
              </Link>
            ) : (
              <Link
                href="/worldcup/login"
                className="rounded-md border-2 border-white bg-white px-3 py-1.5 text-[13px] font-semibold text-[#126BFF] shadow-sm transition-colors hover:bg-white/95 sm:text-sm"
              >
                Log In
              </Link>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
                FIFA World Cup 2026
              </span>
              {subtitle ? (
                <span className="truncate text-xs font-medium text-white/80 sm:text-sm">{subtitle}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {picksHref ? (
                <Link href={picksHref} className={activeTab === "picks" ? pillActive : pillIdle}>
                  Picks
                </Link>
              ) : (
                <Link href="/worldcup/login" className={pillIdle}>
                  Log in
                </Link>
              )}

              {competitionPicksHref ? (
                <Link
                  href={competitionPicksHref}
                  className={
                    competitionPicksIncomplete
                      ? activeTab === "competition-picks"
                        ? pillCompetitionIncompleteActive
                        : pillCompetitionIncompleteIdle
                      : activeTab === "competition-picks"
                        ? pillActive
                        : pillIdle
                  }
                  aria-label={
                    competitionPicksIncomplete && competitionPicksCompletion
                      ? `Competition Picks incomplete (${competitionPicksCompletion.completed} of ${competitionPicksCompletion.total})`
                      : "Competition Picks"
                  }
                >
                  {competitionPicksIncomplete ? (
                    <>
                      <span className="mr-1 font-semibold" aria-hidden>
                        !
                      </span>
                      Competition Picks
                    </>
                  ) : (
                    "Competition Picks"
                  )}
                </Link>
              ) : (
                <button type="button" disabled className={`${pillIdle} cursor-not-allowed text-white/70`}>
                  Competition Picks
                </button>
              )}

              <Link href="/worldcup/results" className={activeTab === "results" ? pillActive : pillIdle}>
                Results
              </Link>

              {settingsHref ? (
                <Link href={settingsHref} className={activeTab === "settings" ? pillActive : pillIdle}>
                  Settings
                </Link>
              ) : (
                <button type="button" disabled className={`${pillIdle} cursor-not-allowed text-white/70`}>
                  Settings
                </button>
              )}

              {participantId ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Log out
                </button>
              ) : null}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
