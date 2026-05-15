import Image from "next/image";
import Link from "next/link";
import {
  ChartBarIcon,
  RocketLaunchIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import {
  paperPunterCompactPrimaryButtonClass,
  paperPunterFeaturedCardClass,
  paperPunterHowItWorksCardClass,
  paperPunterLargePanelClass,
  paperPunterNavLinkClass,
  paperPunterNavLinkOutlineClass,
  paperPunterPrimaryCtaButtonClass,
  paperPunterSecondaryOutlineCtaButtonClass,
  paperPunterWorldCupLogoLinkClass,
} from "@/lib/worldCupBranding";

const BRAND_BLUE = "#126BFF";

export default function PaperPunterLandingPage() {
  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{
        background: `linear-gradient(165deg, #5AAEFF 0%, #4AA3FF 28%, #2F8EF3 58%, #1769D6 85%, #115CC4 100%)`,
      }}
    >
      <div className="fixed top-0 left-0 right-0 z-50 shadow-[0_6px_20px_rgba(15,23,42,0.12)]">
      {/* Brand bar — single sharp diagonal via two solid stops (no clip-path wedges); wordmark centered */}
      <header className="relative z-20 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(118deg, ${BRAND_BLUE} 50%, #ffffff 50%)`,
          }}
        />
        <h1 className="relative z-10 flex min-h-[52px] w-full translate-x-1 items-center justify-center gap-3 whitespace-nowrap px-4 py-2.5 font-black italic tracking-tight [-webkit-text-size-adjust:100%] sm:min-h-[58px] sm:translate-x-1.5 sm:gap-4 sm:px-6 sm:py-3 md:min-h-[60px] md:translate-x-2 md:gap-5 lg:min-h-[64px] lg:translate-x-3 lg:py-3">
          <span
            className="leading-none pr-0.5 text-white sm:pr-1"
            style={{ fontSize: "clamp(1.35rem, 3.25vw + 0.38rem, 3.5rem)" }}
          >
            Paper
          </span>
          <span
            className="pl-0.5 leading-none sm:pl-1"
            style={{
              fontSize: "clamp(1.35rem, 3.25vw + 0.38rem, 3.5rem)",
              color: BRAND_BLUE,
            }}
          >
            Punter
          </span>
        </h1>
      </header>

      <nav
        aria-label="Primary"
        className="relative z-20 border-b border-[#0d52d4] bg-[#126BFF] text-white"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-4 py-1.5 sm:justify-end sm:gap-x-2 sm:px-6 sm:py-2">
          <Link href="/worldcup/login" className={paperPunterNavLinkClass}>
            Log In
          </Link>
          <Link href="/paperpunter/create-competition" className={paperPunterNavLinkOutlineClass}>
            Create Competition
          </Link>
        </div>
      </nav>
      </div>

      <main className="relative z-10 mx-auto flex min-h-0 max-w-6xl flex-col px-4 pb-20 pt-[calc(146px+1.5rem)] text-slate-900 sm:px-6 sm:pb-28 sm:pt-[calc(132px+2rem)] md:pt-[calc(136px+2.25rem)] lg:pt-[calc(140px+2.25rem)]">
        {/* Hero — white panel: product pitch + featured competition + proof pills */}
        <div className={paperPunterLargePanelClass}>
          <div className="p-6 sm:p-8 lg:p-10">
            <section className="grid w-full gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
              <div className="flex flex-col text-center sm:text-left">
                <h2 className="text-[1.65rem] font-extrabold leading-[1.12] tracking-tight text-slate-900 sm:text-4xl md:text-[2.35rem] md:leading-[1.1] lg:max-w-xl">
                  Run Private Tipping Competitions Without The Spreadsheet
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:mx-0 sm:mt-5 sm:text-lg sm:text-slate-700">
                  PaperPunter makes it easy to run prediction comps for mates,
                  offices, clubs, and major sporting events — with picks, leaderboards,
                  and results in one place.
                </p>
                <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:mx-0 sm:max-w-none sm:flex-row sm:flex-wrap">
                  <Link href="/worldcup/register" className={paperPunterPrimaryCtaButtonClass}>
                    Join World Cup Competition
                  </Link>
                  <a href="#" className={paperPunterSecondaryOutlineCtaButtonClass}>
                    Create Your Own Competition
                  </a>
                </div>
              </div>

              <div className="flex justify-center lg:justify-end lg:pt-1">
                <div className={paperPunterFeaturedCardClass}>
                  <div className="bg-gradient-to-r from-[#126BFF] to-[#0F5BE8] px-4 py-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/95">
                      Featured Competition
                    </p>
                  </div>
                  <div className="bg-white px-5 pb-6 pt-5 sm:px-6 sm:pb-7">
                    <h3 className="text-center text-xl font-bold text-slate-900 sm:text-2xl">
                      FIFA World Cup 2026
                    </h3>
                    <p className="mt-2 text-center text-sm text-slate-600">
                      104 matches · Private leaderboard · Free to enter
                    </p>

                    <div className="mt-5 flex justify-center">
                      <Link
                        href="/worldcup/login"
                        aria-label="FIFA World Cup tipping — log in"
                        className={paperPunterWorldCupLogoLinkClass}
                      >
                        <Image
                          src="/mundial-2026-world-cup.svg"
                          alt="FIFA World Cup 2026"
                          width={606}
                          height={650}
                          className="h-auto w-auto max-h-[min(104px,30vw)] max-w-[min(260px,85vw)] object-contain sm:max-h-[120px] sm:max-w-[280px]"
                          priority
                          unoptimized
                        />
                      </Link>
                    </div>

                    <div className="mt-6">
                      <Link href="/worldcup/login" className={paperPunterCompactPrimaryButtonClass}>
                        Enter Competition
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              aria-label="Product highlights"
              className="mt-10 border-t border-slate-100 pt-8 sm:mt-12 sm:pt-10"
            >
              <ul className="flex flex-wrap items-center justify-center gap-3 sm:justify-start sm:gap-3.5">
                <li className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm sm:text-xs">
                  No spreadsheets
                </li>
                <li className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm sm:text-xs">
                  Private leaderboards
                </li>
                <li className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm sm:text-xs">
                  Mobile friendly
                </li>
                <li className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm sm:text-xs">
                  Built for mates, offices, and clubs
                </li>
              </ul>
            </section>
          </div>
        </div>

        <section
          id="how-it-works"
          className={`mx-auto mt-10 w-full max-w-6xl scroll-mt-24 sm:mt-12 ${paperPunterLargePanelClass}`}
        >
          <div className="border-b border-slate-100 px-6 py-8 text-center sm:px-10 sm:py-10">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              How it works
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              PaperPunter gives your group one place to pick, compare, and
              celebrate — whether it&apos;s the weekend footy or a global event.
            </p>
          </div>

          <div className="grid gap-5 px-6 pb-8 sm:grid-cols-3 sm:gap-6 sm:px-10 sm:pb-10">
            <div className={paperPunterHowItWorksCardClass}>
              <RocketLaunchIcon
                className="mb-4 h-10 w-10 text-[#1068f4]"
                aria-hidden
              />
              <p className="text-sm font-semibold text-slate-900">
                Create A Competition
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Spin up a competition with rounds, scoring, and cut-offs built
                in — no manual sheets or broken formulas.
              </p>
            </div>
            <div className={paperPunterHowItWorksCardClass}>
              <UserGroupIcon
                className="mb-4 h-10 w-10 text-[#1068f4]"
                aria-hidden
              />
              <p className="text-sm font-semibold text-slate-900">
                Invite Your Group
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Send a secure link so players join once and submit picks from
                phone or desktop — perfect for offices and club chats.
              </p>
            </div>
            <div className={paperPunterHowItWorksCardClass}>
              <ChartBarIcon
                className="mb-4 h-10 w-10 text-[#1068f4]"
                aria-hidden
              />
              <p className="text-sm font-semibold text-slate-900">
                Track The Leaderboard
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Results roll into live standings automatically — everyone sees
                who&apos;s on top after each round or match day.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
