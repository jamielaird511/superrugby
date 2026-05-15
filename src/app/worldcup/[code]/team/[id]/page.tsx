"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import Link from "next/link";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";
import {
  WORLD_CUP_PAGE_BACKGROUND,
  worldCupContentCardClass,
  worldCupFixedHeaderPaddingTopClass,
  worldCupFormAlertErrorClass,
  worldCupModalPanelClass,
} from "@/lib/worldCupBranding";
import {
  WORLD_CUP_PARTICIPANT_UPDATED_EVENT,
  worldCupParticipantSubtitle,
  type WorldCupParticipantUpdatedDetail,
} from "@/lib/worldCupParticipantDisplay";
import { resolveWorldCupTenant } from "@/lib/worldCupIds";
import {
  clearWorldCupParticipantId,
  readWorldCupParticipantId,
  writeWorldCupParticipantId,
} from "@/lib/worldCupStorage";

const PICKS_MAIN_SHELL_CLASS = `mx-auto w-full max-w-5xl min-w-0 px-4 pb-8 sm:px-6 ${worldCupFixedHeaderPaddingTopClass}`;

/**
 * FIFA 3-letter code → filename stem under `/public/flags/{stem}.svg`.
 * Subset uses ISO 3166-1 alpha-2; England/Scotland use `gb-eng` / `gb-sct`.
 */
const FLAG_CODE_MAP: Record<string, string> = {
  AUS: "au",
  IRN: "ir",
  IRQ: "iq",
  JPN: "jp",
  JOR: "jo",
  QAT: "qa",
  KSA: "sa",
  KOR: "kr",
  UZB: "uz",
  ALG: "dz",
  CPV: "cv",
  COD: "cd",
  EGY: "eg",
  GHA: "gh",
  CIV: "ci",
  MAR: "ma",
  SEN: "sn",
  RSA: "za",
  TUN: "tn",
  CAN: "ca",
  CUW: "cw",
  HAI: "ht",
  MEX: "mx",
  PAN: "pa",
  USA: "us",
  ARG: "ar",
  BRA: "br",
  COL: "co",
  ECU: "ec",
  PAR: "py",
  URU: "uy",
  NZL: "nz",
  AUT: "at",
  BEL: "be",
  BIH: "ba",
  CRO: "hr",
  CZE: "cz",
  ENG: "gb-eng",
  FRA: "fr",
  GER: "de",
  NED: "nl",
  NOR: "no",
  POR: "pt",
  SCO: "gb-sct",
  ESP: "es",
  SWE: "se",
  SUI: "ch",
  TUR: "tr",
};

type Fixture = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  round_id: string;
};

const PLACEHOLDER_PICK_MARGIN = 1;

const PICK_DRAW = "DRAW";

type PickRow = { picked_team: string; margin: number };
type PendingPickClear = { fixtureId: string; pickedTeamCode: string };
type MatchResult = {
  home_goals: number;
  away_goals: number;
  home_team_code: string;
  away_team_code: string;
  winning_team: string | null;
};
type CompetitionPickMeta = { completed: number; total: number };

function marginForWorldCupPick(pickedTeamCode: string): number {
  return pickedTeamCode === PICK_DRAW ? 0 : PLACEHOLDER_PICK_MARGIN;
}

function teamDisplayName(code: string, namesByCode: Record<string, string>) {
  const name = namesByCode[code];
  return name && name.trim() !== "" ? name : code;
}

type WorldCupTeamRow = {
  code: string;
  name: string;
  flag_emoji: string | null;
  flag_url: string | null;
};

type FixtureGroup = { dateKey: string; heading: string; fixtures: Fixture[] };

function worldCupTeamLookupKey(code: string) {
  return code.trim().toUpperCase();
}

function localFlagSvgPathForFifaCode(fifaCode: string): string {
  const stem = FLAG_CODE_MAP[worldCupTeamLookupKey(fifaCode)];
  return stem ? `/flags/${stem}.svg` : "";
}

function rawFlagEmojiFromRow(wc: WorldCupTeamRow): string {
  const v = wc.flag_emoji;
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

function rawFlagUrlFromRow(wc: WorldCupTeamRow): string {
  const v = wc.flag_url;
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.trim();
}

function worldCupFixtureSideParts(
  code: string,
  wcByCode: Record<string, WorldCupTeamRow>,
  rugbyNamesByCode: Record<string, string>
): { flagUrl: string; flagEmoji: string; label: string } {
  const wc = wcByCode[worldCupTeamLookupKey(code)];
  const fallback = teamDisplayName(code, rugbyNamesByCode);
  const mappedLocal = localFlagSvgPathForFifaCode(code);
  if (!wc) {
    return { flagUrl: mappedLocal, flagEmoji: "", label: fallback };
  }
  const dbUrl = rawFlagUrlFromRow(wc);
  const flagUrl = dbUrl || mappedLocal;
  const emoji = rawFlagEmojiFromRow(wc);
  const nameFromWc = wc.name?.trim() ?? "";
  const label = nameFromWc !== "" ? nameFromWc : fallback;
  return { flagUrl, flagEmoji: emoji, label };
}

function WorldCupFixtureSideText({
  code,
  wcByCode,
  rugbyNamesByCode,
  stacked = false,
}: {
  code: string;
  wcByCode: Record<string, WorldCupTeamRow>;
  rugbyNamesByCode: Record<string, string>;
  stacked?: boolean;
}) {
  const { flagUrl, flagEmoji, label } = worldCupFixtureSideParts(code, wcByCode, rugbyNamesByCode);
  return (
    <span
      className={
        stacked
          ? "inline-flex flex-col items-center justify-center gap-1 text-center"
          : "inline-flex items-center gap-1.5"
      }
    >
      {flagUrl ? (
        <img
          src={flagUrl}
          alt=""
          width={stacked ? 32 : 22}
          height={stacked ? 24 : 16}
          className={
            stacked
              ? "mb-0.5 h-6 w-auto shrink-0 rounded-sm border border-slate-200 object-cover"
              : "h-4 w-auto shrink-0 rounded-sm border border-white/15 object-cover"
          }
          loading="lazy"
          decoding="async"
        />
      ) : flagEmoji.length > 0 ? (
        <span
          className={
            stacked
              ? "mb-0.5 select-none text-2xl leading-none [font-variant-emoji:emoji]"
              : "select-none text-lg leading-none [font-variant-emoji:emoji]"
          }
          aria-hidden
        >
          {flagEmoji}
        </span>
      ) : null}
      <span className={stacked ? "text-center font-semibold leading-tight" : "line-clamp-2 max-w-full text-center font-medium leading-snug"}>
        {label}
      </span>
    </span>
  );
}

function formatKickoff(kickoffAt: string | null) {
  if (!kickoffAt) return "TBD";
  return new Date(kickoffAt).toLocaleString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isLockedByKickoffUtc(kickoffAt: string | null): boolean {
  if (!kickoffAt) return false;
  const kickoffMs = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoffMs)) return false;
  return kickoffMs <= Date.now();
}

function isWorldCupFixtureCompleted(result: MatchResult | undefined): boolean {
  if (!result) return false;
  return result.home_goals != null && result.away_goals != null;
}

/** From final score only (home win / away win / draw). */
function actualWorldCupResultCodeFromScore(result: MatchResult): string {
  const h = result.home_goals ?? 0;
  const a = result.away_goals ?? 0;
  if (h > a) return worldCupTeamLookupKey(result.home_team_code);
  if (a > h) return worldCupTeamLookupKey(result.away_team_code);
  return PICK_DRAW;
}

type CompletedPickSide = "correct" | "wrong_pick" | "right_outcome" | "muted";

function worldCupCompletedPickSideState(
  thisCode: string,
  actualCode: string,
  pickedNorm: string | null,
  isThisSelected: boolean
): CompletedPickSide {
  if (actualCode === thisCode) {
    if (isThisSelected && pickedNorm === actualCode) return "correct";
    return "right_outcome";
  }
  if (isThisSelected && pickedNorm === thisCode) return "wrong_pick";
  return "muted";
}

function completedPickCellClass(side: CompletedPickSide): string {
  const base =
    "flex min-h-[46px] min-w-0 w-full cursor-default select-none items-center justify-center gap-1 rounded-md border-2 px-3 py-1.5 text-center text-xs font-medium sm:px-4 sm:text-[13px]";
  switch (side) {
    case "correct":
      return `${base} border-emerald-500 bg-emerald-50/90 font-semibold text-emerald-950`;
    case "wrong_pick":
      return `${base} border-red-400 bg-red-50/90 font-semibold text-red-950`;
    case "right_outcome":
      return `${base} border-emerald-400 bg-emerald-50/40 text-slate-800 ring-1 ring-inset ring-emerald-200/80`;
    case "muted":
      return `${base} border-slate-200/90 bg-slate-50 text-slate-500 opacity-[0.58]`;
    default:
      return base;
  }
}

function fixtureDateGroupParts(kickoffAt: string | null): { dateKey: string; heading: string } {
  if (!kickoffAt) return { dateKey: "TBD", heading: "TBD" };
  const d = new Date(kickoffAt);
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";

  const dateKey = `${year}-${month}-${day}`;
  const heading = d.toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return { dateKey, heading };
}

export default function WorldCupTeamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const routeParticipantId = (params?.id as string) || "";
  const code = typeof params?.code === "string" ? params.code : "";
  const tenant = useMemo(() => resolveWorldCupTenant(code), [code]);
  if (!tenant) notFound();

  const tenantPrefix = tenant ? `/worldcup/${tenant.slug}` : "/worldcup";

  const [participant, setParticipant] = useState<{
    id: string;
    name: string;
    team_name: string;
  } | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [teamNamesByCode, setTeamNamesByCode] = useState<Record<string, string>>({});
  const [worldCupTeamsByCode, setWorldCupTeamsByCode] = useState<Record<string, WorldCupTeamRow>>(
    {}
  );
  const [picksByFixtureId, setPicksByFixtureId] = useState<Record<string, PickRow>>({});
  const [matchResultsByFixtureId, setMatchResultsByFixtureId] = useState<Record<string, MatchResult>>(
    {}
  );
  const [competitionPickMeta, setCompetitionPickMeta] = useState<CompetitionPickMeta | null>(null);
  const [savingFixtureId, setSavingFixtureId] = useState<string | null>(null);
  const [pickErrorByFixtureId, setPickErrorByFixtureId] = useState<Record<string, string | null>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamsMetadataError, setTeamsMetadataError] = useState<string | null>(null);
  const [pendingPickClear, setPendingPickClear] = useState<PendingPickClear | null>(null);

  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<WorldCupParticipantUpdatedDetail>;
      const d = ce.detail;
      if (!d || d.participantId !== routeParticipantId) return;
      setParticipant((prev) =>
        prev && prev.id === d.participantId ? { ...prev, team_name: d.team_name } : prev
      );
    };
    window.addEventListener(WORLD_CUP_PARTICIPANT_UPDATED_EVENT, handler);
    return () => window.removeEventListener(WORLD_CUP_PARTICIPANT_UPDATED_EVENT, handler);
  }, [routeParticipantId]);

  useEffect(() => {
    if (!tenant) return;
    const syncParticipantFromServer = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const storedId = readWorldCupParticipantId(tenant.slug);
      if (!storedId || storedId !== routeParticipantId) return;
      try {
        const res = await fetch(
          `/api/worldcup/participant?participantId=${encodeURIComponent(
            routeParticipantId
          )}&tenant=${tenant.slug}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          participant?: { id: string; name: string; team_name: string; league_id: string };
        };
        const p = json.participant;
        if (!p || p.league_id !== tenant.leagueId) return;
        setParticipant((prev) =>
          prev && prev.id === p.id ? { id: p.id, name: p.name, team_name: p.team_name } : prev
        );
      } catch {
        /* ignore transient refetch errors */
      }
    };
    const onFocus = () => void syncParticipantFromServer();
    const onVisibility = () => void syncParticipantFromServer();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [routeParticipantId, tenant]);

  useEffect(() => {
    if (routeParticipantId && tenant) {
      void loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParticipantId, tenant?.slug]);

  useEffect(() => {
    if (!pendingPickClear) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingPickClear(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingPickClear]);

  useEffect(() => {
    if (!tenant) return;
    const loadMeta = async () => {
      const participantId = readWorldCupParticipantId(tenant.slug);
      if (!participantId || participantId !== routeParticipantId) {
        setCompetitionPickMeta(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/worldcup/competition-picks?participantId=${encodeURIComponent(
            routeParticipantId
          )}&tenant=${tenant.slug}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as { completion?: CompetitionPickMeta };
        if (!res.ok || !json.completion) {
          setCompetitionPickMeta(null);
          return;
        }
        setCompetitionPickMeta(json.completion);
      } catch {
        setCompetitionPickMeta(null);
      }
    };
    void loadMeta();
    const onFocus = () => void loadMeta();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [routeParticipantId, tenant]);

  async function loadDashboard() {
    if (!tenant) return;
    try {
      setLoading(true);
      setError(null);

      const storedId = readWorldCupParticipantId(tenant.slug);
      if (storedId && storedId !== routeParticipantId) {
        router.replace(`${tenantPrefix}/team/${storedId}`);
        return;
      }
      if (!storedId && routeParticipantId) {
        writeWorldCupParticipantId(tenant.slug, routeParticipantId);
      }

      const participantRes = await fetch(
        `/api/worldcup/participant?participantId=${encodeURIComponent(
          routeParticipantId
        )}&tenant=${tenant.slug}`,
        { cache: "no-store" }
      );
      if (!participantRes.ok) {
        clearWorldCupParticipantId(tenant.slug);
        router.replace(`${tenantPrefix}/login`);
        return;
      }

      const participantJson = (await participantRes.json()) as {
        participant?: { id: string; name: string; team_name: string; league_id: string };
      };
      const participantData = participantJson.participant;
      if (!participantData || participantData.league_id !== tenant.leagueId) {
        clearWorldCupParticipantId(tenant.slug);
        router.replace(`${tenantPrefix}/login`);
        return;
      }

      setParticipant(participantData);

      setTeamsMetadataError(null);
      const teamsMetaRes = await fetch("/api/worldcup/teams-metadata", { cache: "no-store" });
      const teamsMetaJson = (await teamsMetaRes.json()) as {
        teamNamesByCode?: Record<string, string>;
        worldCupTeams?: WorldCupTeamRow[];
        error?: string;
        details?: string;
      };
      if (!teamsMetaRes.ok) {
        const msg =
          (typeof teamsMetaJson.details === "string" && teamsMetaJson.details) ||
          teamsMetaJson.error ||
          "Failed to load team names and flags";
        setTeamsMetadataError(msg);
        setTeamNamesByCode({});
        setWorldCupTeamsByCode({});
      } else {
        const map: Record<string, string> = {};
        for (const [code, name] of Object.entries(teamsMetaJson.teamNamesByCode || {})) {
          map[code] = name;
        }
        setTeamNamesByCode(map);
        const wcMap: Record<string, WorldCupTeamRow> = {};
        for (const row of teamsMetaJson.worldCupTeams || []) {
          const c = row?.code?.trim();
          if (!c) continue;
          const key = worldCupTeamLookupKey(c);
          wcMap[key] = {
            code: c,
            name: row.name,
            flag_emoji: row.flag_emoji,
            flag_url: row.flag_url ?? null,
          };
        }
        setWorldCupTeamsByCode(wcMap);
      }

      const fixturesRes = await fetch(
        `/api/worldcup/fixtures?includePast=true&tenant=${tenant.slug}`,
        { cache: "no-store" }
      );
      const fixturesJson = (await fixturesRes.json()) as {
        fixtures?: Fixture[];
        error?: string;
      };
      if (!fixturesRes.ok) {
        throw new Error(fixturesJson.error || "Failed to load fixtures");
      }
      const fixtureList = fixturesJson.fixtures || [];
      setFixtures(fixtureList);

      const wcResultsRes = await fetch(`/api/worldcup/results?tenant=${tenant.slug}`, {
        cache: "no-store",
      });
      const wcResultsJson = (await wcResultsRes.json()) as {
        rounds?: Array<{
          fixtures?: Array<{
            id: string;
            home_team_code: string;
            away_team_code: string;
            winning_team: string | null;
            home_goals: number | null;
            away_goals: number | null;
          }>;
        }>;
      };
      if (wcResultsRes.ok) {
        const resultMap: Record<string, MatchResult> = {};
        for (const round of wcResultsJson.rounds || []) {
          for (const fx of round.fixtures || []) {
            if (fx.home_goals == null || fx.away_goals == null) continue;
            resultMap[fx.id] = {
              home_goals: fx.home_goals,
              away_goals: fx.away_goals,
              home_team_code: fx.home_team_code,
              away_team_code: fx.away_team_code,
              winning_team: fx.winning_team,
            };
          }
        }
        setMatchResultsByFixtureId(resultMap);
      } else {
        setMatchResultsByFixtureId({});
      }

      const fixtureIds = fixtureList.map((x: Fixture) => x.id);
      if (fixtureIds.length > 0) {
        const picksRes = await fetch(
          `/api/picks?participantId=${encodeURIComponent(participantData.id)}`,
          { cache: "no-store" }
        );
        const picksJson = (await picksRes.json()) as {
          picks?: Array<{ fixture_id: string; picked_team: string; margin: number }>;
          error?: string;
          details?: string;
        };

        if (!picksRes.ok) {
          setPickErrorByFixtureId((prev) => ({
            ...prev,
            __load__:
              (typeof picksJson.details === "string" && picksJson.details) ||
              picksJson.error ||
              "Failed to load picks",
          }));
        } else {
          const idSet = new Set(fixtureIds);
          const map: Record<string, PickRow> = {};
          for (const row of picksJson.picks || []) {
            if (idSet.has(row.fixture_id)) {
              map[row.fixture_id] = {
                picked_team: row.picked_team,
                margin: row.margin,
              };
            }
          }
          setPicksByFixtureId(map);
          setPickErrorByFixtureId((prev) => {
            if (!prev.__load__) return prev;
            const next = { ...prev };
            delete next.__load__;
            return next;
          });
        }
      } else {
        setPicksByFixtureId({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickTeam(fixture: Fixture, pickedTeamCode: string) {
    if (!participant) return;
    if (isWorldCupFixtureCompleted(matchResultsByFixtureId[fixture.id])) return;
    if (isLockedByKickoffUtc(fixture.kickoff_at)) return;

    const currentPick = picksByFixtureId[fixture.id]?.picked_team;
    const isDeselect = currentPick === pickedTeamCode;
    if (isDeselect) {
      setPendingPickClear({ fixtureId: fixture.id, pickedTeamCode });
      return;
    }

    setPickErrorByFixtureId((prev) => ({ ...prev, [fixture.id]: null }));
    setSavingFixtureId(fixture.id);

    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          fixtureId: fixture.id,
          pickedTeamCode,
          pickedMargin: marginForWorldCupPick(pickedTeamCode),
        }),
      });

      let data: { error?: string } = {};
      try {
        const text = await response.text();
        if (text) data = JSON.parse(text) as { error?: string };
      } catch {
        /* ignore */
      }
      if (!response.ok) {
        setPickErrorByFixtureId((prev) => ({
          ...prev,
          [fixture.id]: typeof data.error === "string" ? data.error : "Failed to save pick",
        }));
        return;
      }

      setPicksByFixtureId((prev) => ({
        ...prev,
        [fixture.id]: {
          picked_team: pickedTeamCode,
          margin: marginForWorldCupPick(pickedTeamCode),
        },
      }));
    } catch (e) {
      setPickErrorByFixtureId((prev) => ({
        ...prev,
        [fixture.id]: e instanceof Error ? e.message : "Failed to save pick",
      }));
    } finally {
      setSavingFixtureId(null);
    }
  }

  async function handleConfirmClearPick() {
    if (!participant || !pendingPickClear) return;
    const fixtureId = pendingPickClear.fixtureId;

    setPickErrorByFixtureId((prev) => ({ ...prev, [fixtureId]: null }));
    setSavingFixtureId(fixtureId);
    try {
      const fixture = fixtures.find((f) => f.id === fixtureId);
      if (fixture && isWorldCupFixtureCompleted(matchResultsByFixtureId[fixture.id])) {
        setPendingPickClear(null);
        return;
      }
      if (fixture && isLockedByKickoffUtc(fixture.kickoff_at)) {
        setPendingPickClear(null);
        return;
      }

      const response = await fetch("/api/picks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: participant.id, fixtureId }),
      });
      let clearBody: { error?: string; details?: string } = {};
      try {
        clearBody = (await response.json()) as { error?: string; details?: string };
      } catch {
        /* ignore */
      }

      if (!response.ok) {
        const msg =
          (typeof clearBody.details === "string" && clearBody.details) ||
          (typeof clearBody.error === "string" && clearBody.error) ||
          "Failed to clear pick";
        setPickErrorByFixtureId((prev) => ({ ...prev, [fixtureId]: msg }));
        return;
      }

      setPicksByFixtureId((prev) => {
        const next = { ...prev };
        delete next[fixtureId];
        return next;
      });
      setPendingPickClear(null);
    } catch (e) {
      setPickErrorByFixtureId((prev) => ({
        ...prev,
        [fixtureId]: e instanceof Error ? e.message : "Failed to clear pick",
      }));
    } finally {
      setSavingFixtureId(null);
    }
  }

  if (!tenant) return null;

  if (loading) {
    return (
      <div
        className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-hidden font-sans text-slate-900"
        style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
      >
        <p className="text-slate-600">Loading your picks…</p>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div
        className="flex min-h-screen w-full min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 font-sans text-center"
        style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
      >
        <p className="text-red-600">{error || "Entry not found"}</p>
        <Link
          href={`${tenantPrefix}/login`}
          className="text-sm font-medium text-white underline decoration-white/80 hover:text-white/90"
        >
          Back to World Cup login
        </Link>
      </div>
    );
  }

  const groupedFixtures: FixtureGroup[] = [];
  const fixturesSorted = [...fixtures].sort((a, b) => {
    const aMs = a.kickoff_at ? new Date(a.kickoff_at).getTime() : Number.POSITIVE_INFINITY;
    const bMs = b.kickoff_at ? new Date(b.kickoff_at).getTime() : Number.POSITIVE_INFINITY;
    return aMs - bMs;
  });
  for (const fixture of fixturesSorted) {
    const { dateKey, heading } = fixtureDateGroupParts(fixture.kickoff_at);
    const last = groupedFixtures[groupedFixtures.length - 1];
    if (!last || last.dateKey !== dateKey) {
      groupedFixtures.push({ dateKey, heading, fixtures: [fixture] });
    } else {
      last.fixtures.push(fixture);
    }
  }

  return (
    <div
      className="min-h-screen w-full min-w-0 overflow-x-hidden pb-12 font-sans text-slate-900"
      style={{ background: WORLD_CUP_PAGE_BACKGROUND }}
    >
      <WorldCupHeader
        subtitle={worldCupParticipantSubtitle(participant)}
        initialParticipantId={participant.id}
        competitionPicksCompletion={competitionPickMeta}
        tenantSlug={tenant.slug}
      />

      <main className="w-full">
        <div className={PICKS_MAIN_SHELL_CLASS}>
          <div className={`${worldCupContentCardClass} !p-5 sm:!p-6`}>
            {teamsMetadataError || pickErrorByFixtureId.__load__ ? (
              <div className="space-y-2">
                {teamsMetadataError ? (
                  <div className={worldCupFormAlertErrorClass}>
                    Could not load team flags and labels: {teamsMetadataError}
                  </div>
                ) : null}

                {pickErrorByFixtureId.__load__ ? (
                  <div className={worldCupFormAlertErrorClass}>
                    Could not reload your saved picks: {pickErrorByFixtureId.__load__}
                  </div>
                ) : null}
              </div>
            ) : null}

            <section className="mt-5">
              <h2 className="text-sm font-semibold text-amber-800 sm:text-base">
                Upcoming Fixtures
              </h2>
              {fixtures.length === 0 ? (
                <p className="mt-1.5 text-sm text-slate-500">No upcoming fixtures in this competition.</p>
              ) : (
                <div className="mx-auto mt-2 w-full max-w-4xl space-y-2">
                  {groupedFixtures.map((group) => (
                    <div key={group.dateKey}>
                      <h3 className="mb-1 text-xs font-semibold text-slate-600 sm:text-sm">{group.heading}</h3>
                      <ul className="flex flex-col gap-2">
                        {group.fixtures.map((f) => {
                          const pick = picksByFixtureId[f.id];
                          const isKnockoutFixture = f.match_number >= 73;
                          const homeSelected = pick?.picked_team === f.home_team_code;
                          const drawSelected = pick?.picked_team === PICK_DRAW;
                          const awaySelected = pick?.picked_team === f.away_team_code;
                          const saving = savingFixtureId === f.id;
                          const locked = isLockedByKickoffUtc(f.kickoff_at);
                          const result = matchResultsByFixtureId[f.id];
                          const completed = isWorldCupFixtureCompleted(result);
                          const pickErr = pickErrorByFixtureId[f.id];
                          const homeParts = worldCupFixtureSideParts(
                            f.home_team_code,
                            worldCupTeamsByCode,
                            teamNamesByCode
                          );
                          const awayParts = worldCupFixtureSideParts(
                            f.away_team_code,
                            worldCupTeamsByCode,
                            teamNamesByCode
                          );
                          const pickedNorm = pick?.picked_team
                            ? worldCupTeamLookupKey(pick.picked_team)
                            : null;
                          const actualCode =
                            completed && result ? actualWorldCupResultCodeFromScore(result) : "";
                          const homeNorm = worldCupTeamLookupKey(f.home_team_code);
                          const awayNorm = worldCupTeamLookupKey(f.away_team_code);
                          const homeSideState = completed
                            ? worldCupCompletedPickSideState(
                                homeNorm,
                                actualCode,
                                pickedNorm,
                                homeSelected
                              )
                            : null;
                          const drawSideState = completed
                            ? worldCupCompletedPickSideState(
                                PICK_DRAW,
                                actualCode,
                                pickedNorm,
                                drawSelected
                              )
                            : null;
                          const awaySideState = completed
                            ? worldCupCompletedPickSideState(
                                awayNorm,
                                actualCode,
                                pickedNorm,
                                awaySelected
                              )
                            : null;

                          const pickBtnBase =
                            "flex min-h-[46px] min-w-0 w-full items-center justify-center rounded-md border px-3 py-1.5 text-center text-xs font-medium transition-colors sm:px-4 sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-70";
                          const lockedBtnTone =
                            "disabled:opacity-85 disabled:border-orange-200 disabled:bg-orange-50";
                          const idlePick =
                            "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50";
                          const selectedPick =
                            "border border-[#126BFF] bg-blue-50 font-semibold text-blue-900 shadow-sm";

                          return (
                            <li
                              key={f.id}
                              className={`flex flex-col gap-1.5 rounded-lg border p-2 text-sm shadow-sm transition-shadow sm:p-2.5 ${
                                completed
                                  ? "border-slate-200 bg-white shadow-sm"
                                  : locked
                                    ? "border-orange-300 bg-orange-50/90 shadow-sm"
                                    : "border-slate-200 bg-white shadow-sm"
                              }`}
                            >
                              <div
                                className={`flex flex-col items-center gap-0.5 text-center ${
                                  locked && !completed ? "text-slate-600" : ""
                                }`}
                              >
                                <span
                                  className={`inline-flex items-center justify-center gap-1.5 text-sm font-semibold sm:gap-2 sm:text-base ${
                                    locked && !completed ? "text-slate-800" : "text-slate-900"
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {homeParts.flagUrl ? (
                                      <img
                                        src={homeParts.flagUrl}
                                        alt=""
                                        width={24}
                                        height={16}
                                        className="h-4 w-auto shrink-0 rounded-sm border border-slate-200 object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : homeParts.flagEmoji.length > 0 ? (
                                      <span
                                        className="select-none text-sm leading-none [font-variant-emoji:emoji] sm:text-base"
                                        aria-hidden
                                      >
                                        {homeParts.flagEmoji}
                                      </span>
                                    ) : null}
                                    <span className="max-w-[42vw] truncate whitespace-nowrap sm:max-w-none">
                                      {homeParts.label}
                                    </span>
                                  </span>
                                  <span className="shrink-0 px-0.5 text-xs font-medium text-slate-400">
                                    vs
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="max-w-[42vw] truncate whitespace-nowrap sm:max-w-none">
                                      {awayParts.label}
                                    </span>
                                    {awayParts.flagUrl ? (
                                      <img
                                        src={awayParts.flagUrl}
                                        alt=""
                                        width={24}
                                        height={16}
                                        className="h-4 w-auto shrink-0 rounded-sm border border-slate-200 object-cover"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : awayParts.flagEmoji.length > 0 ? (
                                      <span
                                        className="select-none text-sm leading-none [font-variant-emoji:emoji] sm:text-base"
                                        aria-hidden
                                      >
                                        {awayParts.flagEmoji}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                                <span
                                  className={`text-xs ${locked && !completed ? "text-slate-700" : "text-slate-500"}`}
                                >
                                  {formatKickoff(f.kickoff_at)}
                                </span>
                                {completed && result ? (
                                  <span className="block max-w-full px-1 text-center text-[11px] leading-tight text-slate-500">
                                    Final score: {homeParts.label} {result.home_goals}–
                                    {result.away_goals} {awayParts.label}
                                  </span>
                                ) : null}
                              </div>
                              <div
                                className={
                                  isKnockoutFixture
                                    ? "mt-1 grid w-full max-w-lg grid-cols-1 gap-1.5 sm:mx-auto sm:grid-cols-2 sm:gap-2"
                                    : "mt-1 grid w-full max-w-xl grid-cols-1 gap-1.5 sm:mx-auto sm:grid-cols-3 sm:gap-2"
                                }
                              >
                                {completed && homeSideState ? (
                                  <div
                                    className={completedPickCellClass(homeSideState)}
                                    role="group"
                                    aria-label="Home — result"
                                  >
                                    {homeSideState === "correct" ? (
                                      <span className="shrink-0 text-[11px] leading-none text-emerald-700" aria-hidden>
                                        ✓
                                      </span>
                                    ) : null}
                                    {homeSideState === "wrong_pick" ? (
                                      <span className="shrink-0 text-[11px] leading-none text-red-600" aria-hidden>
                                        ✕
                                      </span>
                                    ) : null}
                                    <WorldCupFixtureSideText
                                      code={f.home_team_code}
                                      wcByCode={worldCupTeamsByCode}
                                      rugbyNamesByCode={teamNamesByCode}
                                      stacked={false}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={saving || locked}
                                    onClick={() => void handlePickTeam(f, f.home_team_code)}
                                    className={`${pickBtnBase} ${homeSelected ? selectedPick : idlePick} ${locked ? lockedBtnTone : ""}`}
                                  >
                                    <WorldCupFixtureSideText
                                      code={f.home_team_code}
                                      wcByCode={worldCupTeamsByCode}
                                      rugbyNamesByCode={teamNamesByCode}
                                      stacked={false}
                                    />
                                  </button>
                                )}
                                {!isKnockoutFixture ? (
                                  completed && drawSideState ? (
                                    <div
                                      className={completedPickCellClass(drawSideState)}
                                      role="group"
                                      aria-label="Draw — result"
                                    >
                                      {drawSideState === "correct" ? (
                                        <span
                                          className="shrink-0 text-[11px] leading-none text-emerald-700"
                                          aria-hidden
                                        >
                                          ✓
                                        </span>
                                      ) : null}
                                      {drawSideState === "wrong_pick" ? (
                                        <span
                                          className="shrink-0 text-[11px] leading-none text-red-600"
                                          aria-hidden
                                        >
                                          ✕
                                        </span>
                                      ) : null}
                                      Draw
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={saving || locked}
                                      onClick={() => void handlePickTeam(f, PICK_DRAW)}
                                      className={`${pickBtnBase} ${drawSelected ? selectedPick : idlePick} ${locked ? lockedBtnTone : ""}`}
                                    >
                                      Draw
                                    </button>
                                  )
                                ) : null}
                                {completed && awaySideState ? (
                                  <div
                                    className={completedPickCellClass(awaySideState)}
                                    role="group"
                                    aria-label="Away — result"
                                  >
                                    {awaySideState === "correct" ? (
                                      <span className="shrink-0 text-[11px] leading-none text-emerald-700" aria-hidden>
                                        ✓
                                      </span>
                                    ) : null}
                                    {awaySideState === "wrong_pick" ? (
                                      <span className="shrink-0 text-[11px] leading-none text-red-600" aria-hidden>
                                        ✕
                                      </span>
                                    ) : null}
                                    <WorldCupFixtureSideText
                                      code={f.away_team_code}
                                      wcByCode={worldCupTeamsByCode}
                                      rugbyNamesByCode={teamNamesByCode}
                                      stacked={false}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={saving || locked}
                                    onClick={() => void handlePickTeam(f, f.away_team_code)}
                                    className={`${pickBtnBase} ${awaySelected ? selectedPick : idlePick} ${locked ? lockedBtnTone : ""}`}
                                  >
                                    <WorldCupFixtureSideText
                                      code={f.away_team_code}
                                      wcByCode={worldCupTeamsByCode}
                                      rugbyNamesByCode={teamNamesByCode}
                                      stacked={false}
                                    />
                                  </button>
                                )}
                              </div>
                              {locked && !completed ? (
                                <div className="flex flex-col items-start gap-1">
                                  <span className="inline-flex rounded-md border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                                    Picks locked
                                  </span>
                                  {result ? (
                                    <p className="text-sm font-semibold text-slate-800">
                                      {teamDisplayName(result.home_team_code, teamNamesByCode)}{" "}
                                      <span
                                        className={
                                          result.winning_team === result.home_team_code
                                            ? "text-orange-700"
                                            : ""
                                        }
                                      >
                                        {result.home_goals}
                                      </span>
                                      {" – "}
                                      <span
                                        className={
                                          result.winning_team === result.away_team_code
                                            ? "text-orange-700"
                                            : ""
                                        }
                                      >
                                        {result.away_goals}
                                      </span>{" "}
                                      {teamDisplayName(result.away_team_code, teamNamesByCode)}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-slate-700">
                                    Kickoff has passed — picks can no longer be changed.
                                  </p>
                                </div>
                              ) : null}
                              {saving ? <p className="text-xs text-slate-500">Saving…</p> : null}
                              {pickErr ? <p className="text-xs text-red-600">{pickErr}</p> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-6 text-center text-xs text-slate-500">
              <Link href="/" className="text-amber-700 underline hover:text-amber-800">
                Super Rugby competition site
              </Link>
            </p>
          </div>
        </div>
      </main>
      {pendingPickClear ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setPendingPickClear(null)}
          role="presentation"
        >
          <div
            className={worldCupModalPanelClass}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-pick-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clear-pick-title" className="text-base font-semibold text-slate-900">
              Clear this pick?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              You currently have a pick saved for this match. Clearing it means you will have no
              pick for this fixture unless you choose another option.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingPickClear(null)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Pick
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmClearPick()}
                className="rounded-md border border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Clear Pick
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
