import { WORLD_CUP_DEFAULT_TENANT_SLUG } from "./worldCupIds";

/**
 * Tenant-scoped browser storage key for the logged-in World Cup participant.
 * Lets two tenant sessions coexist in the same browser without overwriting each other.
 */
export function worldCupParticipantStorageKey(tenantSlug: string): string {
  const slug = tenantSlug.trim().toLowerCase();
  return `worldcup_participant_id:${slug}`;
}

/** Pre-tenant key kept for one-shot migration of existing sessions on the default tenant. */
export const LEGACY_WORLD_CUP_PARTICIPANT_STORAGE_KEY = "worldcup_participant_id" as const;

/**
 * Reads the participant id for the given tenant; if the new key is empty, falls back to
 * the legacy global key (default tenant only) and copies the value forward.
 * Returns `null` outside the browser.
 */
export function readWorldCupParticipantId(tenantSlug: string): string | null {
  if (typeof window === "undefined") return null;
  const key = worldCupParticipantStorageKey(tenantSlug);
  const direct = window.localStorage.getItem(key);
  if (direct) return direct;
  if (tenantSlug.trim().toLowerCase() === WORLD_CUP_DEFAULT_TENANT_SLUG) {
    const legacy = window.localStorage.getItem(LEGACY_WORLD_CUP_PARTICIPANT_STORAGE_KEY);
    if (legacy) {
      try {
        window.localStorage.setItem(key, legacy);
      } catch {
        /* ignore quota errors */
      }
      return legacy;
    }
  }
  return null;
}

export function writeWorldCupParticipantId(tenantSlug: string, participantId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(worldCupParticipantStorageKey(tenantSlug), participantId);
}

export function clearWorldCupParticipantId(tenantSlug: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(worldCupParticipantStorageKey(tenantSlug));
  if (tenantSlug.trim().toLowerCase() === WORLD_CUP_DEFAULT_TENANT_SLUG) {
    window.localStorage.removeItem(LEGACY_WORLD_CUP_PARTICIPANT_STORAGE_KEY);
  }
}
