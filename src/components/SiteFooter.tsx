"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/paperpunter") return null;

  return (
    <footer className="border-t border-slate-200 py-3 px-4 text-center text-sm font-medium text-slate-700">
      <span className="font-semibold">Disclaimer:</span> Unofficial picks tool
      built for a private competition. Not affiliated with ANZ, Super Rugby,
      SANZAAR, or any teams.
    </footer>
  );
}
