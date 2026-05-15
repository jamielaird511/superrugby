"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import PaperPunterBrandStrip from "@/components/paperpunter/PaperPunterBrandStrip";

const pillActive =
  "rounded-full border border-white/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#126BFF]";
const pillIdle =
  "rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20";

type AdminTab = "match-results" | "competition-results" | "participants" | "knockout-fixtures";

type Props = {
  subtitle?: string;
  onLogout?: () => void;
  showTabs?: boolean;
};

export default function WorldCupAdminHeader({ subtitle, onLogout, showTabs = true }: Props) {
  const pathname = usePathname();

  const activeTab: AdminTab = useMemo(() => {
    const normalized = (pathname || "").replace(/\/$/, "");
    if (normalized.includes("/worldcup/admin/competition-results")) {
      return "competition-results";
    }
    if (normalized.includes("/worldcup/admin/participants")) {
      return "participants";
    }
    if (normalized.includes("/worldcup/admin/knockout-fixtures")) {
      return "knockout-fixtures";
    }
    return "match-results";
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden shadow-[0_6px_20px_rgba(15,23,42,0.12)]">
      <PaperPunterBrandStrip />
      <nav
        aria-label="World Cup admin"
        className="w-full border-b border-[#0d52d4] bg-[#126BFF] text-white"
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
              FIFA World Cup 2026
            </span>
            <span className="truncate text-xs font-medium text-white/80 sm:text-sm">
              {subtitle || "Admin"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showTabs ? (
              <>
                <Link
                  href="/worldcup/admin"
                  className={activeTab === "match-results" ? pillActive : pillIdle}
                >
                  Match Results
                </Link>
                <Link
                  href="/worldcup/admin/competition-results"
                  className={activeTab === "competition-results" ? pillActive : pillIdle}
                >
                  Competition Results
                </Link>
                <Link
                  href="/worldcup/admin/participants"
                  className={activeTab === "participants" ? pillActive : pillIdle}
                >
                  Participants
                </Link>
                <Link
                  href="/worldcup/admin/knockout-fixtures"
                  className={activeTab === "knockout-fixtures" ? pillActive : pillIdle}
                >
                  Knockout Fixtures
                </Link>
              </>
            ) : null}

            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </nav>
    </div>
  );
}
