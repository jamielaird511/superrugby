import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://paperpunter.co.nz"),
  alternates: { canonical: "https://paperpunter.co.nz/privacy" },
  title: "Privacy",
  description: "How PaperPunter handles personal information and cookies at a high level.",
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

export default function PrivacyPage() {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <TrustNav />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Privacy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 15 May 2026</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
          <p>
            This page is a plain-English summary. It is not legal advice. If you need a formal
            privacy statement for your organisation, ask your legal adviser.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">What we collect</h2>
          <p>
            To run competitions we typically store things like your name, email, display name,
            picks, scores, and technical logs needed to keep the service secure (for example IP
            address and browser type in standard server logs).
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Why we use it</h2>
          <p>
            We use this information to authenticate you, show leaderboards, apply scoring, fix
            problems, and improve reliability. Competition organisers may also see participant data
            needed to run their pool.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Cookies and storage</h2>
          <p>
            We use cookies or similar storage so you can stay signed in and so the site remembers
            your competition context. You can clear cookies in your browser at any time; you may
            need to sign in again afterwards.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Retention</h2>
          <p>
            We keep data only as long as needed to run the competition and meet legal or security
            obligations. Exact retention can depend on how your organiser uses the product.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Your choices</h2>
          <p>
            You can ask your organiser to update or remove your participation where that is
            reasonable. For privacy requests about PaperPunter itself, contact{" "}
            <a className="font-medium text-[#126BFF] underline hover:text-[#0f5fdf]" href="mailto:support@paperpunter.com">
              support@paperpunter.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
