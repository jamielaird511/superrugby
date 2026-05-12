"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function CreateCompetitionComingSoonPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden pb-20 pt-10 text-slate-900 sm:pb-28 sm:pt-12"
      style={{
        background: `linear-gradient(165deg, #5AAEFF 0%, #4AA3FF 28%, #2F8EF3 58%, #1769D6 85%, #115CC4 100%)`,
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

        <div className="mt-8 rounded-[28px] border-2 border-slate-200 bg-white/96 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-[2px] sm:p-8 sm:mt-10">
          {submitted ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900 sm:text-xl">
                Thanks — we&apos;ll let you know when custom competitions
                launch.
              </p>
              <Link
                href="/paperpunter"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#126BFF] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:bg-[#0f5fdf] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40"
              >
                Back to PaperPunter
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-center text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-3xl md:text-[2rem] md:leading-[1.1]">
                Create Your Own Competition
              </h1>
              <p className="mt-3 text-center text-base font-semibold text-slate-800 sm:text-lg">
                PaperPunter custom competitions are coming soon.
              </p>
              <p className="mx-auto mt-4 max-w-md text-center text-base leading-relaxed text-slate-600 sm:text-[1.05rem] sm:text-slate-700">
                Soon you&apos;ll be able to create private tipping competitions
                for mates, offices, clubs, and events — with picks, leaderboards,
                and results in one place.
              </p>

              <form
                className="mx-auto mt-8 flex max-w-md flex-col gap-5"
                onSubmit={handleSubmit}
                noValidate
              >
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
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#126BFF] focus:ring-2 focus:ring-[#126BFF]/25"
                    placeholder="Your name"
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
                    className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#126BFF] focus:ring-2 focus:ring-[#126BFF]/25"
                    placeholder="you@example.com"
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
                    name="competition"
                    rows={4}
                    className="w-full resize-y rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#126BFF] focus:ring-2 focus:ring-[#126BFF]/25"
                    placeholder="e.g. office Rugby World Cup pool, local club league…"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-1 min-h-12 w-full rounded-xl bg-[#126BFF] px-5 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:scale-[1.01] hover:bg-[#0f5fdf] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40"
                >
                  Register Interest
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
