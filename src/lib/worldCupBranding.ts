/** PaperPunter-aligned full-page background for FIFA / World Cup routes */
export const WORLD_CUP_PAGE_BACKGROUND =
  "linear-gradient(165deg, #5AAEFF 0%, #4AA3FF 28%, #2F8EF3 58%, #1769D6 85%, #115CC4 100%)";

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
export const worldCupContentCardClass =
  "rounded-lg border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-900/10 sm:p-7";
