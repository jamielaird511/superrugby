import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for PaperPunter in plain language.",
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

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <TrustNav />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Terms of use</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: 15 May 2026</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
          <p>
            By using PaperPunter on our websites you agree to these simple terms. If you do not
            agree, please do not use the service.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">The service</h2>
          <p>
            PaperPunter is provided <strong>as is</strong>. We try hard to keep it accurate and
            available, but we do not guarantee uninterrupted access or error-free scoring. Your
            organiser sets the rules for each competition.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Your account</h2>
          <p>
            You are responsible for keeping your password private and for activity under your
            account. Tell your organiser or contact us if you believe someone else has accessed your
            account.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Acceptable use</h2>
          <p>
            Do not misuse the site (for example by attacking it, scraping it in a way that harms
            performance, or trying to access data that is not yours). We may suspend access if we
            need to protect the service or other users.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Limitation of liability</h2>
          <p>
            To the maximum extent allowed by law, PaperPunter and its operators are not liable for
            indirect or consequential loss arising from use of the site. Nothing here excludes
            liability that cannot be excluded by law.
          </p>
          <h2 className="pt-2 text-lg font-semibold text-slate-900">Changes</h2>
          <p>
            We may update these terms or the product from time to time. Continued use after a
            change means you accept the updated terms for new activity on the site.
          </p>
        </div>
      </div>
    </div>
  );
}
