"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNavTiles() {
  const pathname = usePathname();

  const tiles = [
    { href: "/admin", label: "Rounds & Fixtures" },
    { href: "/admin/picks", label: "Picks" },
    { href: "/admin/paper-bets", label: "Paper Bets" },
    { href: "/admin/emails", label: "Emails" },
    { href: "/admin/structure", label: "Structure" },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tiles.map((tile) => {
        const isActive = pathname === tile.href || (tile.href !== "/admin" && pathname?.startsWith(tile.href));
        return (
          <Link
            key={tile.href}
            href={tile.href}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {tile.label}
          </Link>
        );
      })}
    </div>
  );
}
