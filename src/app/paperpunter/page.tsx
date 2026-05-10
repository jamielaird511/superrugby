import Image from "next/image";
import Link from "next/link";
import { ChartBarIcon, TrophyIcon, UserGroupIcon } from "@heroicons/react/24/solid";

const BRAND_BLUE = "#126BFF";

export default function PaperPunterLandingPage() {
  return (
    <div
      className="relative left-1/2 w-screen max-w-none -translate-x-1/2 min-h-screen overflow-hidden text-white"
      style={{
        background: `linear-gradient(180deg, #3B9BFF 0%, ${BRAND_BLUE} 42%, #0956D4 78%, #063A91 100%)`,
      }}
    >
      {/* Brand bar — single sharp diagonal via two solid stops (no clip-path wedges); wordmark centered */}
      <header className="relative z-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(118deg, ${BRAND_BLUE} 50%, #ffffff 50%)`,
          }}
        />
        <h1 className="relative z-10 flex min-h-[76px] w-full translate-x-1 items-center justify-center gap-4 whitespace-nowrap px-4 py-5 font-black italic tracking-tight [-webkit-text-size-adjust:100%] sm:min-h-[92px] sm:translate-x-1.5 sm:gap-5 sm:px-6 sm:py-6 md:min-h-[104px] md:translate-x-2 md:gap-6 lg:min-h-[116px] lg:translate-x-3">
          <span
            className="leading-none pr-0.5 text-white sm:pr-1"
            style={{ fontSize: "clamp(1.5rem, 4vw + 0.45rem, 4.5rem)" }}
          >
            Paper
          </span>
          <span
            className="pl-0.5 leading-none sm:pl-1"
            style={{
              fontSize: "clamp(1.5rem, 4vw + 0.45rem, 4.5rem)",
              color: BRAND_BLUE,
            }}
          >
            Punter
          </span>
        </h1>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 max-w-5xl flex-col px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-12 md:pt-14">
        <section className="mx-auto w-full max-w-2xl text-center">
          <div className="flex justify-center">
            <Link
              href="/worldcup/login"
              aria-label="FIFA World Cup tipping — log in"
              className="inline-flex rounded-2xl bg-white px-6 py-5 shadow-[0_0_0_3px_#fff,0_0_0_7px_rgba(255,255,255,0.35),0_22px_56px_-16px_rgba(0,35,95,0.52),0_8px_24px_-6px_rgba(0,0,0,0.2)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_3px_#fff,0_0_0_8px_rgba(255,255,255,0.42),0_28px_64px_-14px_rgba(0,35,95,0.58),0_12px_32px_-6px_rgba(0,0,0,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/90 sm:rounded-3xl sm:px-8 sm:py-6"
            >
              <Image
                src="/mundial-2026-world-cup.svg"
                alt="FIFA World Cup 2026"
                width={606}
                height={650}
                className="h-auto w-auto max-h-[min(132px,38vw)] max-w-[min(360px,92vw)] object-contain sm:max-h-[156px] sm:max-w-[400px] md:max-h-[176px] md:max-w-[440px]"
                priority
                unoptimized
              />
            </Link>
          </div>
          <h2 className="mt-7 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:mt-9 md:text-[2.35rem] md:leading-[1.15]">
            FIFA World Cup 2026 Tipping Competition
          </h2>

          <div className="mt-8 flex flex-col items-center justify-center sm:mt-9">
            <Link
              href="/worldcup/login"
              className="inline-flex h-12 w-full max-w-[260px] items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-[#126BFF] shadow-lg shadow-black/25 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              Let’s Go
            </Link>
          </div>
        </section>

        <section className="mx-auto mt-16 w-full max-w-5xl sm:mt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold tracking-tight text-white/95">
              How it works
            </h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-6">
            <div className="rounded-2xl border border-white/15 bg-[#0546A8]/45 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <TrophyIcon
                className="mb-4 h-9 w-9 text-white"
                aria-hidden
              />
              <p className="text-sm font-semibold text-white">Pick Match Results</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Choose winners (and draws) for each fixture as the tournament unfolds.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-[#0546A8]/45 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <UserGroupIcon
                className="mb-4 h-9 w-9 text-white"
                aria-hidden
              />
              <p className="text-sm font-semibold text-white">
                Predict Tournament Outcomes
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Lock in your winner, semi-finalists, and group finishes before kickoff.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-[#0546A8]/45 p-6 shadow-lg shadow-black/20 backdrop-blur-sm">
              <ChartBarIcon
                className="mb-4 h-9 w-9 text-white"
                aria-hidden
              />
              <p className="text-sm font-semibold text-white">
                Climb The Leaderboard
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">
                Track your progress and see how you stack up against friends.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
