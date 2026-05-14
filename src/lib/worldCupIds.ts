/**
 * World Cup tenant registry.
 *
 * Each tenant is a self-contained tipping competition. Two tenants may share fixtures
 * (same `competitionId`) while keeping participants/picks/leaderboards separate via
 * different `leagueId`s. Add a new tenant by registering a slug below — no schema
 * changes required if the underlying `leagues` row already exists.
 */

export type WorldCupTenant = {
  /** URL slug, lower-case. Used in `/worldcup/[code]/...` and storage keys. */
  slug: string;
  /** `leagues.id` for this tenant (scopes participants + picks). */
  leagueId: string;
  /** `competitions.id` for this tenant (scopes fixtures + competition picks). */
  competitionId: string;
  /** Human-facing title shown in the nav header. */
  displayName: string;
  /** Env var name carrying the registration access code for this tenant. */
  accessCodeEnvName: string;
};

const TENANTS: Record<string, WorldCupTenant> = {
  fifawc2026: {
    slug: "fifawc2026",
    leagueId: "a908c579-842c-43c8-85d3-229b543bb2a3",
    competitionId: "9e60564e-4be5-4756-b6cb-48ae06f45654",
    displayName: "FIFA World Cup 2026",
    accessCodeEnvName: "WORLDCUP_ACCESS_CODE_FIFAWC2026",
  },
};

export const WORLD_CUP_DEFAULT_TENANT_SLUG = "fifawc2026" as const;

export function listWorldCupTenants(): WorldCupTenant[] {
  return Object.values(TENANTS);
}

export function getDefaultWorldCupTenant(): WorldCupTenant {
  return TENANTS[WORLD_CUP_DEFAULT_TENANT_SLUG];
}

export function resolveWorldCupTenant(
  slug: string | null | undefined
): WorldCupTenant | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  return TENANTS[key] ?? null;
}

/** Resolves a tenant from a request input, falling back to the default tenant. */
export function resolveWorldCupTenantOrDefault(
  slug: string | null | undefined
): WorldCupTenant {
  return resolveWorldCupTenant(slug) ?? getDefaultWorldCupTenant();
}

/** Looks up a World Cup tenant by its `leagues.id`. Used when the participant's tenant is unknown. */
export function findWorldCupTenantByLeagueId(leagueId: string | null | undefined): WorldCupTenant | null {
  if (!leagueId) return null;
  return Object.values(TENANTS).find((t) => t.leagueId === leagueId) ?? null;
}

/**
 * Reads the registration access code for a tenant.
 * Tenant-specific env (`accessCodeEnvName`) wins; for the default tenant only,
 * falls back to the legacy `WORLDCUP_ACCESS_CODE` env so existing deployments keep working.
 */
export function readWorldCupAccessCode(tenant: WorldCupTenant): string | null {
  const tenantSpecific = process.env[tenant.accessCodeEnvName];
  if (tenantSpecific && tenantSpecific.trim()) return tenantSpecific.trim();
  if (tenant.slug === WORLD_CUP_DEFAULT_TENANT_SLUG) {
    const legacy = process.env.WORLDCUP_ACCESS_CODE;
    if (legacy && legacy.trim()) return legacy.trim();
  }
  return null;
}

/** Legacy named exports — used by code paths still in transition. */
export const FIFA_WORLD_CUP_2026_COMPETITION_ID = TENANTS.fifawc2026.competitionId;
export const FIFA_WORLD_CUP_2026_LEAGUE_ID = TENANTS.fifawc2026.leagueId;
