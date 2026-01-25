"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PencilSquareIcon, ChartBarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon, TrophyIcon } from "@heroicons/react/24/outline";

type TeamNavProps = {
  teamId: string;
  teamName: string;
  onLogout: () => void;
};

export default function TeamNav({ teamId, teamName, onLogout }: TeamNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-[#002D47] bg-[#003A5D] shadow-md">
      <div className="mx-auto h-16 max-w-6xl px-6 sm:px-8 lg:px-12 xl:px-16 flex items-center justify-between gap-4">
        {/* Left: ANZ Logo + Team Name Badge */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/brand/logo-anz.svg"
            alt="ANZ"
            className="h-10 w-auto"
          />
          <div className="rounded-lg bg-white px-4 py-2 shadow-sm border border-white/30">
            <span className="text-sm font-semibold text-[#003A5D] whitespace-nowrap">
              {teamName || "Team"}
            </span>
          </div>
        </div>

        {/* Right: Action Buttons - Picks, Results, Settings, Logout */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/team/${teamId}`}
            className={`inline-flex items-center gap-2 h-10 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}`
                ? "bg-[#005A84] text-white font-semibold"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span>Picks</span>
          </Link>
          <Link
            href={`/team/${teamId}/results`}
            className={`inline-flex items-center gap-2 h-10 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}/results`
                ? "bg-[#005A84] text-white font-semibold"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            <span>Results</span>
          </Link>
          <Link
            href="/leaderboard"
            className={`inline-flex items-center gap-2 h-10 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === "/leaderboard"
                ? "bg-[#005A84] text-white font-semibold"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <TrophyIcon className="h-4 w-4" />
            <span>Leaderboard</span>
          </Link>
          <Link
            href={`/team/${teamId}/settings`}
            className={`inline-flex items-center gap-2 h-10 px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}/settings`
                ? "bg-[#005A84] text-white font-semibold"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Cog6ToothIcon className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-[#00A3E0] text-white text-sm font-medium transition-colors hover:bg-[#0096CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
