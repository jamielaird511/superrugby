/**
 * Nav / header label for a World Cup participant. Prefer `team_name` (editable in settings)
 * so display-name changes show immediately; fall back to `name` from registration.
 */
export function worldCupParticipantSubtitle(p: { name: string; team_name: string }): string {
  const team = (p.team_name || "").trim();
  if (team.length > 0) return team;
  const nm = (p.name || "").trim();
  if (nm.length > 0) return nm;
  return "Participant";
}

/** Fired after a successful display-name save so other WC tabs can update in-memory state. */
export const WORLD_CUP_PARTICIPANT_UPDATED_EVENT = "worldcup-participant-updated";

export type WorldCupParticipantUpdatedDetail = {
  participantId: string;
  team_name: string;
};
