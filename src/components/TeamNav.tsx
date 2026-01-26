"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PencilSquareIcon, ChartBarIcon, Cog6ToothIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";

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
          <div className="rounded-sm border border-white/50 bg-transparent px-4 py-2">
            <span className="text-sm font-semibold text-white whitespace-nowrap">
              {teamName || "Team"}
            </span>
          </div>
        </div>

        {/* Right: Action Buttons - Picks, Results, Settings, Logout */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/team/${teamId}`}
            className={`inline-flex items-center justify-center gap-2 h-10 w-32 px-0 rounded-md text-sm font-semibold transition-all duration-150 border bg-white text-[#003A5D] hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}`
                ? "border-[#004165] border-2"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <PencilSquareIcon className="h-4 w-4" />
            <span>Picks</span>
          </Link>
          <Link
            href={`/team/${teamId}/results`}
            className={`inline-flex items-center justify-center gap-2 h-10 w-32 px-0 rounded-md text-sm font-semibold transition-all duration-150 border bg-white text-[#003A5D] hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}/results`
                ? "border-[#004165] border-2"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ChartBarIcon className="h-4 w-4" />
            <span>Results</span>
          </Link>
          <Link
            href={`/team/${teamId}/settings`}
            className={`inline-flex items-center justify-center gap-2 h-10 w-32 px-0 rounded-md text-sm font-semibold transition-all duration-150 border bg-white text-[#003A5D] hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              pathname === `/team/${teamId}/settings`
                ? "border-[#004165] border-2"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Cog6ToothIcon className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          <button
            onClick={onLogout}
            type="button"
            className="inline-flex items-center justify-center gap-2 h-10 w-32 px-0 rounded-md text-sm font-semibold transition-all duration-150 border border-transparent bg-cyan-700 text-white hover:bg-cyan-600 hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
