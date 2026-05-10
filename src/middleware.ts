import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_HOSTS = ["paperpunter.com", "www.paperpunter.com"];

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

export function middleware(request: NextRequest) {
  const allowedHosts = allowedPaperPunterHosts();
  if (!matchesPaperPunterHost(request.headers.get("host"), allowedHosts)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Send /lander to /paperpunter — not to /, since some hosts redirect / → /lander (would loop).
  if (pathname === "/lander" || pathname.startsWith("/lander/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/paperpunter";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/lander", "/lander/(.*)"],
};
