import { NextResponse } from "next/server";
import {
  resolveWorldCupTenant,
  resolveWorldCupTenantOrDefault,
  type WorldCupTenant,
} from "./worldCupIds";

/**
 * Reads the `tenant` query string from a request URL. Empty / missing returns `null`.
 */
export function readTenantSlugFromUrl(req: { url: string }): string | null {
  try {
    const slug = new URL(req.url).searchParams.get("tenant");
    return slug && slug.trim() ? slug.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Strict tenant resolution from `?tenant=` — returns `{ ok: false, response }` 400 if a
 * tenant is provided but unknown. If no tenant is provided, uses the default tenant for
 * backwards-compatible legacy callers.
 */
export function resolveTenantFromRequest(req: { url: string }):
  | { ok: true; tenant: WorldCupTenant }
  | { ok: false; response: NextResponse } {
  const slug = readTenantSlugFromUrl(req);
  if (slug) {
    const tenant = resolveWorldCupTenant(slug);
    if (!tenant) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unknown World Cup tenant", details: `tenant=${slug}` },
          { status: 400 }
        ),
      };
    }
    return { ok: true, tenant };
  }
  return { ok: true, tenant: resolveWorldCupTenantOrDefault(null) };
}

/**
 * Strict tenant resolution from a parsed JSON body (`body.tenant`), falling back to URL
 * `?tenant=` then default tenant. Mirrors `resolveTenantFromRequest`.
 */
export function resolveTenantFromBodyOrUrl(
  body: unknown,
  req: { url: string }
):
  | { ok: true; tenant: WorldCupTenant }
  | { ok: false; response: NextResponse } {
  const bodySlug =
    body && typeof body === "object" && "tenant" in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).tenant ?? "").trim().toLowerCase()
      : "";
  if (bodySlug) {
    const tenant = resolveWorldCupTenant(bodySlug);
    if (!tenant) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unknown World Cup tenant", details: `tenant=${bodySlug}` },
          { status: 400 }
        ),
      };
    }
    return { ok: true, tenant };
  }
  return resolveTenantFromRequest(req);
}
