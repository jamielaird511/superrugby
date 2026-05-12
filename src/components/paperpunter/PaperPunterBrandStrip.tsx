"use client";

import Link from "next/link";

const BRAND_BLUE = "#126BFF";

/**
 * Paper/Punter diagonal wordmark — links to marketing home.
 * Used on World Cup routes for shared PaperPunter identity.
 */
export default function PaperPunterBrandStrip() {
  return (
    <Link
      href="/paperpunter"
      className="relative z-20 block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(118deg, ${BRAND_BLUE} 50%, #ffffff 50%)`,
        }}
      />
      <span className="relative z-10 flex min-h-[48px] w-full translate-x-1 items-center justify-center gap-2.5 whitespace-nowrap px-4 py-2 font-black italic tracking-tight [-webkit-text-size-adjust:100%] sm:min-h-[52px] sm:translate-x-1.5 sm:gap-3 sm:px-6 sm:py-2.5 md:min-h-[54px] md:translate-x-2 md:gap-4">
        <span
          className="leading-none pr-0.5 text-white sm:pr-1"
          style={{ fontSize: "clamp(1.2rem, 2.8vw + 0.35rem, 2.75rem)" }}
        >
          Paper
        </span>
        <span
          className="pl-0.5 leading-none sm:pl-1"
          style={{
            fontSize: "clamp(1.2rem, 2.8vw + 0.35rem, 2.75rem)",
            color: BRAND_BLUE,
          }}
        >
          Punter
        </span>
      </span>
    </Link>
  );
}
