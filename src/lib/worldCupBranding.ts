/** PaperPunter-aligned full-page background for FIFA / World Cup routes */
export const WORLD_CUP_PAGE_BACKGROUND =
  "linear-gradient(165deg, #5AAEFF 0%, #4AA3FF 28%, #2F8EF3 58%, #1769D6 85%, #115CC4 100%)";

/**
 * Shared radius vocabulary for PaperPunter + World Cup (squared-off, professional).
 * Do not use `rounded-none` globally — keep a light radius on surfaces.
 */
export const ppwcRadiusLg = "rounded-lg";
export const ppwcRadiusMd = "rounded-md";
/** Marketing chips + primary nav tab pills only */
export const ppwcRadiusNavPill = "rounded-full";

/**
 * World Cup route roots (under layout full-bleed) should be full width only:
 * `min-h-screen w-full min-w-0 overflow-x-hidden` — use max-w / mx-auto on inner shells only.
 */

/** Offset for fixed PaperPunter strip + World Cup nav (matches visual header height) */
export const worldCupFixedHeaderPaddingTopClass = "pt-[132px] sm:pt-[138px]";

/** Main content band — centered column under fixed header */
export const worldCupMainContentShellClass = `mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 ${worldCupFixedHeaderPaddingTopClass}`;

/** Login/register outer shell — horizontal padding + top offset for fixed header */
export const worldCupAuthPageContentShellClass = `mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 ${worldCupFixedHeaderPaddingTopClass}`;

/** Main content card over the gradient — large container: lg radius, slightly stronger border, subtle shadow */
export const worldCupContentCardClass = `${ppwcRadiusLg} border border-slate-300 bg-white/95 p-6 shadow-md shadow-slate-900/10 sm:p-7`;

/** Primary CTA on World Cup auth flows */
export const worldCupPrimaryButtonClass = `${ppwcRadiusMd} h-10 w-full bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-50`;

/** Primary button inline (settings cards, admin row actions) */
export const worldCupPrimaryButtonInlineClass = `${ppwcRadiusMd} bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-50`;

/** Outlined secondary (e.g. register from login) */
export const worldCupSecondaryOutlineButtonClass = `${ppwcRadiusMd} flex h-10 w-full items-center justify-center border-2 border-[#126BFF] bg-white px-4 py-2 text-sm font-semibold text-[#126BFF] transition-colors hover:bg-slate-50`;

/** Auth + compact form inputs (World Cup login/register/admin login, settings fields) */
export const worldCupAuthInputClass = `${ppwcRadiusMd} h-10 w-full border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30`;

/** Tertiary / admin link chip */
export const worldCupTertiaryLinkChipClass = `${ppwcRadiusMd} border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:text-xs`;

/** Footer save on admin competition-results */
export const worldCupAdminSaveButtonClass = `${ppwcRadiusMd} bg-[#126BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f5fdf] disabled:opacity-50`;

/** Modal / dialog panels (admin match results clear) */
export const worldCupModalPanelClass = `${ppwcRadiusLg} relative z-10 w-full max-w-md border border-slate-300 bg-white p-6 shadow-lg`;

/** Bordered section panels (competition picks, settings, admin inner blocks) */
export const worldCupSectionPanelClass = `${ppwcRadiusLg} border-2 border-zinc-300 p-4`;

export const worldCupNestedPanelClass = `${ppwcRadiusLg} border-2 border-zinc-300 p-3`;

/** Select controls (competition picks, admin) */
export const worldCupSelectControlClass = `${ppwcRadiusMd} h-10 w-full border border-zinc-300 px-3 text-sm disabled:bg-zinc-100`;
export const worldCupDataTableWrapClass = `${ppwcRadiusLg} overflow-x-auto border-2 border-zinc-300`;

export const worldCupEmptyStateBoxClass = `${ppwcRadiusLg} border-2 border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600`;

// --- PaperPunter marketing / create-competition (same gradient family as World Cup) ---

/** Hero + “How it works” outer shells */
export const paperPunterLargePanelClass = `${ppwcRadiusLg} border-2 border-slate-300 bg-white/96 shadow-md shadow-slate-900/10 backdrop-blur-[2px]`;

/** Featured competition card on homepage */
export const paperPunterFeaturedCardClass = `${ppwcRadiusLg} w-full max-w-md overflow-hidden border-2 border-[#2E7BFF]/30 bg-white shadow-md shadow-blue-900/10`;

/** Logo / visual CTA frame inside featured card */
export const paperPunterWorldCupLogoLinkClass = `${ppwcRadiusLg} inline-flex border-2 border-slate-200 bg-white px-7 py-4 shadow-md ring-2 ring-[#126BFF]/15 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:ring-[#126BFF]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/35 sm:px-9 sm:py-5`;

export const paperPunterPrimaryCtaButtonClass = `${ppwcRadiusMd} inline-flex min-h-12 w-full flex-1 items-center justify-center bg-[#126BFF] px-5 py-3 text-center text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-[1.01] hover:bg-[#0f5fdf] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40 sm:min-w-[220px] sm:flex-none sm:px-8`;

export const paperPunterSecondaryOutlineCtaButtonClass = `${ppwcRadiusMd} inline-flex min-h-11 w-full flex-1 items-center justify-center border-2 border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition-all duration-200 hover:scale-[1.01] hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:min-w-[200px] sm:flex-none`;

export const paperPunterCompactPrimaryButtonClass = `${ppwcRadiusMd} flex min-h-11 w-full items-center justify-center bg-[#126BFF] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-[1.01] hover:bg-[#0f5fdf] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterTextInputClass = `w-full ${ppwcRadiusMd} border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#126BFF] focus:ring-2 focus:ring-[#126BFF]/25`;

export const paperPunterCreateFormSubmitClass = `mt-1 min-h-12 w-full ${ppwcRadiusMd} bg-[#126BFF] px-5 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:scale-[1.01] hover:bg-[#0f5fdf] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterInlinePrimaryButtonClass = `mt-8 inline-flex min-h-12 items-center justify-center ${ppwcRadiusMd} bg-[#126BFF] px-6 py-3 text-sm font-bold text-white shadow-md transition-all duration-200 hover:bg-[#0f5fdf] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterHowItWorksCardClass = `${ppwcRadiusLg} border-2 border-slate-300 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#126BFF]/40 hover:shadow-md`;

export const paperPunterNavLinkClass = `${ppwcRadiusNavPill} px-2.5 py-1 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:px-3 sm:text-sm`;

export const paperPunterNavLinkOutlineClass = `${ppwcRadiusNavPill} border border-white/25 bg-white/10 px-2.5 py-1 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:px-3 sm:text-sm`;
