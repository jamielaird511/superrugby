"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  paperPunterCreateFormSubmitClass,
  paperPunterInlinePrimaryButtonClass,
  paperPunterLargePanelClass,
  paperPunterMarketingPageBackground,
  paperPunterTextInputClass,
  worldCupFormAlertErrorClass,
  worldCupFormAlertSuccessClass,
} from "@/lib/worldCupBranding";

export default function CreateCompetitionComingSoonPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [competitionIdea, setCompetitionIdea] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/paperpunter/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          competitionIdea,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        return;
      }
      setName("");
      setEmail("");
      setCompetitionIdea("");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden pb-16 pt-8 text-slate-900 sm:pb-24 sm:pt-10"
      style={{
        background: paperPunterMarketingPageBackground,
      }}
    >
      <div className="mx-auto max-w-lg px-4 sm:px-6">
        <Link
          href="/paperpunter"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/95 shadow-sm transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          <span aria-hidden className="text-base leading-none">
            ←
          </span>
          Back to Home
        </Link>

        <div className={`mt-6 p-5 sm:mt-8 sm:p-7 ${paperPunterLargePanelClass}`}>
          {submitted ? (
            <div className="text-center">
              <div className={`mx-auto max-w-md ${worldCupFormAlertSuccessClass}`}>
                <p className="text-base font-semibold text-emerald-950 sm:text-lg">
                  Thanks — we&apos;ll be in touch when custom competitions are ready.
                </p>
              </div>
              <Link href="/paperpunter" className={`${paperPunterInlinePrimaryButtonClass} mt-6 inline-flex`}>
                Back to PaperPunter
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-center text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-3xl md:text-[2rem] md:leading-[1.1]">
                Create Your Own Competition
              </h1>
              <p className="mt-3 text-center text-base font-medium text-slate-700 sm:text-lg">
                Custom competitions are on the way.
              </p>
              <p className="mx-auto mt-4 max-w-md text-center text-base leading-relaxed text-slate-600 sm:text-[1.05rem] sm:text-slate-700">
                Soon you&apos;ll be able to create private tipping competitions
                for mates, offices, clubs, and events — with picks, leaderboards,
                and results in one place.
              </p>

              <form
                className="mx-auto mt-6 flex max-w-md flex-col gap-4"
                onSubmit={handleSubmit}
                noValidate
              >
                {error && (
                  <p className={worldCupFormAlertErrorClass} role="alert">
                    {error}
                  </p>
                )}
                <div>
                  <label
                    htmlFor="interest-name"
                    className="mb-1.5 block text-sm font-semibold text-slate-800"
                  >
                    Name
                  </label>
                  <input
                    id="interest-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={paperPunterTextInputClass}
                    placeholder="Your name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label
                    htmlFor="interest-email"
                    className="mb-1.5 block text-sm font-semibold text-slate-800"
                  >
                    Email
                  </label>
                  <input
                    id="interest-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={paperPunterTextInputClass}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label
                    htmlFor="interest-competition"
                    className="mb-1.5 block text-sm font-semibold text-slate-800"
                  >
                    What kind of competition would you run?{" "}
                    <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="interest-competition"
                    name="competitionIdea"
                    rows={4}
                    value={competitionIdea}
                    onChange={(e) => setCompetitionIdea(e.target.value)}
                    className={paperPunterTextInputClass}
                    placeholder="e.g. office Rugby World Cup pool, local club league…"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  className={paperPunterCreateFormSubmitClass}
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Register Interest"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
