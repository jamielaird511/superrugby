"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import WorldCupHeader from "@/components/worldcup/WorldCupHeader";

const FIFA_WORLD_CUP_2026_COMPETITION_ID =
  "9e60564e-4be5-4756-b6cb-48ae06f45654";
const FIFA_WORLD_CUP_2026_LEAGUE_ID = "a908c579-842c-43c8-85d3-229b543bb2a3";
const STORAGE_KEY = "worldcup_participant_id";

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

type Round = { id: string; season: number; round_number: number };
type Fixture = {
  id: string;
  match_number: number;
  home_team_code: string;
  away_team_code: string;
  kickoff_at: string | null;
  round_id: string;
};

/** Default margin for home/away picks; API requires 1 or 13 for non-DRAW. */
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

/** Maps UI selection to `pickedMargin` for POST /api/picks (contract unchanged). */
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

/** Raw `flag_emoji` from DB (no trim — preserves regional-indicator sequences). */
function rawFlagEmojiFromRow(wc: WorldCupTeamRow): string {
  const v = wc.flag_emoji;
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

/** `flag_url` from DB; trim only ASCII whitespace for a valid URL string. */
function rawFlagUrlFromRow(wc: WorldCupTeamRow): string {
  const v = wc.flag_url;
  if (v == null) return "";
  const s = typeof v === "string" ? v : String(v);
  return s.trim();
}

/** Flag (DB URL, then local `/public/flags`, then emoji) + label; falls back when WC row missing. */
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
      <span className={stacked ? "text-center font-semibold leading-tight" : ""}>{label}</span>
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

function entrantDisplayName(p: { name: string; team_name: string }) {
  const real = p.name?.trim();
  return real !== "" ? real : p.team_name;
}

export default function WorldCupTeamDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const routeParticipantId = params.id as string;
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
    if (routeParticipantId) {
      void loadDashboard();
    }
  }, [routeParticipantId]);

  useEffect(() => {
    if (!pendingPickClear) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingPickClear(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingPickClear]);

  useEffect(() => {
    const loadMeta = async () => {
      const participantId = localStorage.getItem(STORAGE_KEY);
      if (!participantId || participantId !== routeParticipantId) {
        setCompetitionPickMeta(null);
        return;
      }
      try {
        const res = await fetch(
          `/api/worldcup/competition-picks?participantId=${encodeURIComponent(routeParticipantId)}`,
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
  }, [routeParticipantId]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId && storedId !== routeParticipantId) {
        router.replace(`/worldcup/team/${storedId}`);
        return;
      }
      if (!storedId && routeParticipantId) {
        localStorage.setItem(STORAGE_KEY, routeParticipantId);
      }

      const participantRes = await fetch(
        `/api/worldcup/participant?participantId=${encodeURIComponent(routeParticipantId)}`
      );
      if (!participantRes.ok) {
        localStorage.removeItem(STORAGE_KEY);
        router.replace("/worldcup/login");
        return;
      }

      const participantJson = (await participantRes.json()) as {
        participant?: { id: string; name: string; team_name: string; league_id: string };
      };
      const participantData = participantJson.participant;
      if (!participantData || participantData.league_id !== FIFA_WORLD_CUP_2026_LEAGUE_ID) {
        localStorage.removeItem(STORAGE_KEY);
        router.replace("/worldcup/login");
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

      const fixturesRes = await fetch("/api/worldcup/fixtures?includePast=true");
      const fixturesJson = (await fixturesRes.json()) as {
        fixtures?: Fixture[];
        error?: string;
      };
      if (!fixturesRes.ok) {
        throw new Error(fixturesJson.error || "Failed to load fixtures");
      }
      const fixtureList = fixturesJson.fixtures || [];
      setFixtures(fixtureList);

      const wcResultsRes = await fetch("/api/worldcup/results");
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
        headers: {
          "Content-Type": "application/json",
        },
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
          [fixture.id]:
            typeof data.error === "string" ? data.error : "Failed to save pick",
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
      if (fixture && isLockedByKickoffUtc(fixture.kickoff_at)) {
        setPendingPickClear(null);
        return;
      }

      const response = await fetch("/api/picks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          fixtureId,
        }),
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
        setPickErrorByFixtureId((prev) => ({
          ...prev,
          [fixtureId]: msg,
        }));
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 font-sans text-slate-900">
        <p className="text-slate-600">Loading your picks…</p>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4 font-sans text-center">
        <p className="text-red-600">{error || "Entry not found"}</p>
        <Link
          href="/worldcup/login"
          className="text-sm text-amber-700 underline hover:text-amber-800"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-sky-50 pb-12 font-sans text-slate-900">
      <WorldCupHeader
        subtitle={entrantDisplayName(participant)}
        initialParticipantId={participant.id}
      />

      <main className="mx-auto max-w-5xl px-4 pt-28 pb-8 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Your picks</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your individual picks for this competition. Everything below is scoped to the FIFA
            World Cup 2026 competition only.
          </p>
          {competitionPickMeta && competitionPickMeta.completed < competitionPickMeta.total ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Competition Picks incomplete ({competitionPickMeta.completed}/{competitionPickMeta.total}).
              Complete them in the Competition Picks tab.
            </div>
          ) : null}

          {teamsMetadataError ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Could not load team flags and labels: {teamsMetadataError}
            </div>
          ) : null}

          {pickErrorByFixtureId.__load__ ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              Could not reload your saved picks: {pickErrorByFixtureId.__load__}
            </div>
          ) : null}

          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Upcoming fixtures
            </h2>
            {fixtures.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No upcoming fixtures in this competition.</p>
            ) : (
              <div className="mt-3 space-y-5">
                {groupedFixtures.map((group) => (
                  <div key={group.dateKey}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">{group.heading}</h3>
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/40">
                      {group.fixtures.map((f) => {
                        const pick = picksByFixtureId[f.id];
                        const isKnockoutFixture = f.match_number >= 73;
                        const homeSelected = pick?.picked_team === f.home_team_code;
                        const drawSelected = pick?.picked_team === PICK_DRAW;
                        const awaySelected = pick?.picked_team === f.away_team_code;
                        const saving = savingFixtureId === f.id;
                        const locked = isLockedByKickoffUtc(f.kickoff_at);
                        const result = matchResultsByFixtureId[f.id];
                        const pickErr = pickErrorByFixtureId[f.id];
                        const baseBtn =
                          "flex h-20 flex-1 flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70";
                        const lockedBtnTone = "disabled:opacity-85 disabled:border-orange-200 disabled:bg-orange-50";
                        const idleBtn =
                          "max-w-[220px] border-gray-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm";
                        const selectedBtn =
                          "max-w-[220px] border-2 border-blue-600 bg-blue-50 text-blue-700 shadow-sm";

                        return (
                          <li
                            key={f.id}
                            className={`mb-4 flex flex-col gap-3 rounded-xl border p-4 text-sm shadow-sm transition-shadow ${
                              locked
                                ? "border-orange-200 bg-orange-50"
                                : "border-[#dbe3ef] bg-[#f8fafc] hover:shadow-md"
                            }`}
                          >
                            <div
                              className={`mb-3 flex flex-col items-center gap-1 text-center ${
                                locked ? "text-slate-600" : ""
                              }`}
                            >
                              {(() => {
                                const home = worldCupFixtureSideParts(
                                  f.home_team_code,
                                  worldCupTeamsByCode,
                                  teamNamesByCode
                                );
                                const away = worldCupFixtureSideParts(
                                  f.away_team_code,
                                  worldCupTeamsByCode,
                                  teamNamesByCode
                                );
                                return (
                                  <span
                                    className={`inline-flex items-center justify-center gap-3 text-base font-semibold ${
                                      locked ? "text-slate-800" : "text-slate-900"
                                    }`}
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      {home.flagUrl ? (
                                        <img
                                          src={home.flagUrl}
                                          alt=""
                                          width={28}
                                          height={20}
                                          className="h-5 w-auto shrink-0 rounded-sm border border-slate-200 object-cover"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : home.flagEmoji.length > 0 ? (
                                        <span
                                          className="select-none text-lg leading-none [font-variant-emoji:emoji]"
                                          aria-hidden
                                        >
                                          {home.flagEmoji}
                                        </span>
                                      ) : null}
                                      <span className="whitespace-nowrap">{home.label}</span>
                                    </span>
                                    <span className="px-1 text-sm font-medium text-slate-400">vs</span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="whitespace-nowrap">{away.label}</span>
                                      {away.flagUrl ? (
                                        <img
                                          src={away.flagUrl}
                                          alt=""
                                          width={28}
                                          height={20}
                                          className="h-5 w-auto shrink-0 rounded-sm border border-slate-200 object-cover"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : away.flagEmoji.length > 0 ? (
                                        <span
                                          className="select-none text-lg leading-none [font-variant-emoji:emoji]"
                                          aria-hidden
                                        >
                                          {away.flagEmoji}
                                        </span>
                                      ) : null}
                                    </span>
                                  </span>
                                );
                              })()}
                              <span className={locked ? "text-sm text-slate-700" : "text-sm text-slate-500"}>
                                {formatKickoff(f.kickoff_at)}
                              </span>
                            </div>
                            <div
                              className={
                                isKnockoutFixture
                                  ? "mt-4 flex justify-center gap-6"
                                  : "mt-4 flex flex-wrap justify-center gap-6"
                              }
                            >
                              <button
                                type="button"
                                disabled={saving || locked}
                                onClick={() => void handlePickTeam(f, f.home_team_code)}
                                className={`${baseBtn} ${isKnockoutFixture ? "w-48 flex-none" : "w-44 flex-none"} ${homeSelected ? selectedBtn : idleBtn} ${locked ? lockedBtnTone : ""}`}
                              >
                                <WorldCupFixtureSideText
                                  code={f.home_team_code}
                                  wcByCode={worldCupTeamsByCode}
                                  rugbyNamesByCode={teamNamesByCode}
                                  stacked
                                />
                              </button>
                              {!isKnockoutFixture ? (
                                <button
                                  type="button"
                                  disabled={saving || locked}
                                  onClick={() => void handlePickTeam(f, PICK_DRAW)}
                                  className={`${baseBtn} w-44 flex-none ${drawSelected ? selectedBtn : idleBtn} ${locked ? lockedBtnTone : ""}`}
                                >
                                  Draw
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={saving || locked}
                                onClick={() => void handlePickTeam(f, f.away_team_code)}
                                className={`${baseBtn} ${isKnockoutFixture ? "w-48 flex-none" : "w-44 flex-none"} ${awaySelected ? selectedBtn : idleBtn} ${locked ? lockedBtnTone : ""}`}
                              >
                                <WorldCupFixtureSideText
                                  code={f.away_team_code}
                                  wcByCode={worldCupTeamsByCode}
                                  rugbyNamesByCode={teamNamesByCode}
                                  stacked
                                />
                              </button>
                            </div>
                            {locked ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-800">
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

          <p className="mt-8 text-center text-xs text-slate-500">
            <Link href="/" className="text-amber-700 underline hover:text-amber-800">
              Super Rugby competition site
            </Link>
          </p>
        </div>
      </main>
      {pendingPickClear ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setPendingPickClear(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
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
                Keep pick
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmClearPick()}
                className="rounded-md border border-blue-600 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Clear pick
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
