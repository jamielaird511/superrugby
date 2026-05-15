import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_HOSTS = [
  "paperpunter.com",
  "www.paperpunter.com",
  "paperpunter.co.nz",
  "www.paperpunter.co.nz",
];

function allowedPaperPunterHosts(): Set<string> {
  const raw = process.env.PAPERPUNTER_HOSTS?.trim();
  const list =
    raw && raw.length > 0 ? raw.split(",") : DEFAULT_HOSTS;
  return new Set(
    list.map((h) => h.trim().toLowerCase()).filter(Boolean)
  );
}

function matchesPaperPunterHost(
  hostHeader: string | null,
  allowed: Set<string>
): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.split(":")[0]?.toLowerCase();
  return Boolean(host && allowed.has(host));
}

function withPaperPunterFullBleed(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-paperpunter-full-bleed", "1");
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Full-bleed shell: PaperPunter marketing (incl. `/` on PaperPunter hosts), World Cup, trust pages.
  if (
    pathname === "/paperpunter" ||
    pathname.startsWith("/paperpunter/") ||
    pathname === "/worldcup" ||
    pathname.startsWith("/worldcup/") ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return withPaperPunterFullBleed(request);
  }

  const allowedHosts = allowedPaperPunterHosts();
  const isPaperPunterHost = matchesPaperPunterHost(
    request.headers.get("host"),
    allowedHosts
  );

  if (isPaperPunterHost && pathname === "/") {
    return withPaperPunterFullBleed(request);
  }

  if (!isPaperPunterHost) {
    return NextResponse.next();
  }

  // Canonical root: avoid legacy /lander paths on PaperPunter domains.
  if (pathname === "/lander" || pathname.startsWith("/lander/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/lander",
    "/lander/(.*)",
    "/paperpunter",
    "/paperpunter/:path*",
    "/worldcup",
    "/worldcup/:path*",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
  ],
};
