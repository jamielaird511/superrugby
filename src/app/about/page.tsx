import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://paperpunter.co.nz"),
  alternates: { canonical: "https://paperpunter.co.nz/about" },
  title: "About",
  description:
    "What PaperPunter is: private tipping competitions, World Cup pools, and simple leaderboards.",
};

function TrustNav() {
  return (
    <nav
      aria-label="PaperPunter pages"
      className="mb-10 flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 pb-6 text-sm font-medium text-slate-600"
    >
      <Link href="/paperpunter" className="text-[#126BFF] hover:underline">
        Home
      </Link>
      <Link href="/about" className="text-[#126BFF] hover:underline">
        About
      </Link>
      <Link href="/contact" className="text-[#126BFF] hover:underline">
        Contact
      </Link>
      <Link href="/privacy" className="text-[#126BFF] hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="text-[#126BFF] hover:underline">
        Terms
      </Link>
    </nav>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <TrustNav />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">About PaperPunter</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
          <p>
            PaperPunter is a small web app for running <strong>private tipping competitions</strong>—so
            friends, offices, and clubs can make picks, see results, and follow a leaderboard without
            juggling spreadsheets.
          </p>
          <p>
            We also host structured pools for events such as the FIFA World Cup, with clear scoring
            and pick flows designed for real-world groups.
          </p>
          <p>
            PaperPunter is an independent product. It is{" "}
            <strong>not affiliated with FIFA, World Rugby, SANZAAR, Super Rugby, broadcasters, or any
            national team or club</strong>, unless we say otherwise on a specific page.
          </p>
          <p>
            Competitions are run by the people who invite you. If you have questions about rules,
            access codes, or prizes, ask your competition organiser.
          </p>
        </div>
      </div>
    </div>
  );
}
