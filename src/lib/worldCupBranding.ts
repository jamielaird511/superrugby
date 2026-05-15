/** PaperPunter-aligned full-page background for FIFA / World Cup routes */
export const WORLD_CUP_PAGE_BACKGROUND =
  "linear-gradient(165deg, #5AAEFF 0%, #4AA3FF 28%, #2F8EF3 58%, #1769D6 85%, #115CC4 100%)";

/** PaperPunter marketing pages: softer mid-band so white panels read as the hero surface */
export const paperPunterMarketingPageBackground =
  "linear-gradient(165deg, #5AAEFF 0%, #8FC0FF 26%, #d9ebff 44%, #3d8aeb 74%, #115CC4 100%)";

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

/** Main content card over the gradient */
export const worldCupContentCardClass = `${ppwcRadiusLg} border border-slate-200 bg-white/95 p-6 shadow-sm sm:p-7`;

/** Table header cell (Title Case copy in markup; no forced uppercase) */
export const worldCupTableThClass = "px-3 py-2.5 text-xs font-semibold text-zinc-600";

/** Inline form alerts (World Cup + PaperPunter interest) */
export const worldCupFormAlertErrorClass =
  "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800";
export const worldCupFormAlertSuccessClass =
  "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900";

/** Primary CTA on World Cup auth flows */
export const worldCupPrimaryButtonClass = `${ppwcRadiusMd} h-10 w-full bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-50`;

/** Primary button inline (settings cards, admin row actions) */
export const worldCupPrimaryButtonInlineClass = `${ppwcRadiusMd} bg-[#126BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] disabled:cursor-not-allowed disabled:opacity-50`;

/** Outlined secondary (e.g. register from login) */
export const worldCupSecondaryOutlineButtonClass = `${ppwcRadiusMd} flex h-10 w-full items-center justify-center border border-[#126BFF] bg-white px-4 py-2 text-sm font-semibold text-[#126BFF] transition-colors hover:bg-slate-50`;

/** Auth + compact form inputs (World Cup login/register/admin login, settings fields) */
export const worldCupAuthInputClass = `${ppwcRadiusMd} h-10 w-full border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#126BFF] focus:ring-1 focus:ring-[#126BFF]/30`;

/** Tertiary / admin link chip */
export const worldCupTertiaryLinkChipClass = `${ppwcRadiusMd} border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:text-xs`;

/** Footer save on admin competition-results */
export const worldCupAdminSaveButtonClass = `${ppwcRadiusMd} bg-[#126BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f5fdf] disabled:opacity-50`;

/** Modal / dialog panels (admin match results clear) */
export const worldCupModalPanelClass = `${ppwcRadiusLg} relative z-10 w-full max-w-md border border-slate-200 bg-white p-6 shadow-md`;

/** Bordered section panels (competition picks, settings, admin inner blocks) */
export const worldCupSectionPanelClass = `${ppwcRadiusLg} border border-slate-200 bg-white/90 p-4 shadow-sm`;

export const worldCupNestedPanelClass = `${ppwcRadiusLg} border border-slate-200 bg-white/90 p-3 shadow-sm`;

/** Select controls (competition picks, admin) */
export const worldCupSelectControlClass = `${ppwcRadiusMd} h-10 w-full border border-slate-200 px-3 text-sm disabled:bg-zinc-100`;
export const worldCupDataTableWrapClass = `${ppwcRadiusLg} overflow-x-auto border border-slate-200 bg-white shadow-sm`;

export const worldCupEmptyStateBoxClass = `${ppwcRadiusLg} border border-slate-200 bg-zinc-50 p-4 text-sm text-zinc-600`;

// --- PaperPunter marketing / create-competition (same gradient family as World Cup) ---

/** Hero + “How it works” outer shells */
export const paperPunterLargePanelClass = `${ppwcRadiusLg} border border-slate-200 bg-white/98 shadow-sm backdrop-blur-[2px]`;

/** Featured competition card on homepage */
export const paperPunterFeaturedCardClass = `${ppwcRadiusLg} w-full max-w-md overflow-hidden border border-slate-200 bg-white shadow-sm`;

/** Logo / visual CTA frame inside featured card */
export const paperPunterWorldCupLogoLinkClass = `${ppwcRadiusLg} inline-flex border border-slate-200 bg-white px-7 py-4 shadow-sm ring-1 ring-[#126BFF]/20 transition-colors hover:bg-slate-50 hover:ring-[#126BFF]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/35 sm:px-9 sm:py-5`;

export const paperPunterPrimaryCtaButtonClass = `${ppwcRadiusMd} inline-flex min-h-12 w-full flex-1 items-center justify-center bg-[#126BFF] px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40 sm:min-w-[220px] sm:flex-none sm:px-8`;

export const paperPunterSecondaryOutlineCtaButtonClass = `${ppwcRadiusMd} inline-flex min-h-11 w-full flex-1 items-center justify-center border border-slate-300 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:min-w-[200px] sm:flex-none`;

export const paperPunterCompactPrimaryButtonClass = `${ppwcRadiusMd} flex min-h-11 w-full items-center justify-center bg-[#126BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterTextInputClass = `w-full ${ppwcRadiusMd} border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-[#126BFF] focus:ring-2 focus:ring-[#126BFF]/20`;

export const paperPunterCreateFormSubmitClass = `mt-1 min-h-12 w-full ${ppwcRadiusMd} bg-[#126BFF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterInlinePrimaryButtonClass = `mt-8 inline-flex min-h-12 items-center justify-center ${ppwcRadiusMd} bg-[#126BFF] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0f5fdf] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#126BFF]/40`;

export const paperPunterHowItWorksCardClass = `${ppwcRadiusLg} border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md`;

export const paperPunterNavLinkClass = `${ppwcRadiusNavPill} px-2.5 py-1 text-[13px] font-semibold text-white/95 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:px-3 sm:text-sm`;

export const paperPunterNavLinkOutlineClass = `${ppwcRadiusNavPill} border border-white/25 bg-white/10 px-2.5 py-1 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:px-3 sm:text-sm`;
