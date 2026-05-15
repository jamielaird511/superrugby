import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach PaperPunter or your competition organiser.",
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

export default function ContactPage() {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <TrustNav />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Contact</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
          <p>
            <strong>Questions about your competition</strong> (rules, deadlines, access codes,
            prizes): contact the organiser who invited you. They manage your pool—not PaperPunter.
          </p>
          <p>
            <strong>Questions about the PaperPunter product</strong> (bugs, billing, or account
            issues on our domains): email{" "}
            <a className="font-medium text-[#126BFF] underline hover:text-[#0f5fdf]" href="mailto:support@paperpunter.com">
              support@paperpunter.com
            </a>
            . We aim to reply within a few business days.
          </p>
          <p className="text-sm text-slate-600">
            Please do not send passwords or access codes by email. We will never ask you for your
            password in an unsolicited message.
          </p>
        </div>
      </div>
    </div>
  );
}
