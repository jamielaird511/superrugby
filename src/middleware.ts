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

export function middleware(request: NextRequest) {
  const allowedHosts = allowedPaperPunterHosts();
  if (!matchesPaperPunterHost(request.headers.get("host"), allowedHosts)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Canonical root: avoid legacy /lander paths on PaperPunter domains.
  if (pathname === "/lander" || pathname.startsWith("/lander/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  // Serve PaperPunter marketing at `/` while keeping `/paperpunter` as a working path.
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/paperpunter";
    const headers = new Headers(request.headers);
    headers.set("x-paperpunter-root-rewrite", "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/lander", "/lander/(.*)"],
};
