import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PaperBetsLeaderboardSection from "./PaperBetsLeaderboardSection";

type League = { id: string; name: string | null };
type Round = { id: string; season: number; round_number: number };

type Row = {
  match_number: number;
  fixture_id: string;
  kickoff_at: string | null;
  home_team_code: string;
  away_team_code: string;

  picked_team: string | null;
  margin: number | null;

  paper_bet_id: string | null;
  paper_outcome: string | null;
  stake: string | null;
  paper_odds: string | null;

  winning_team: string | null;
  margin_band: string | null;

  home_1_12_odds: string | null;
  home_13_plus_odds: string | null;
  draw_odds: string | null;
  away_1_12_odds: string | null;
  away_13_plus_odds: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeExpectedOdds(r: Row): number | null {
  if (!r.picked_team) return null;
  if (r.picked_team === "DRAW") return toNum(r.draw_odds);

  if (r.margin == null) return null;
  const isHome = r.picked_team === r.home_team_code;
  const isAway = r.picked_team === r.away_team_code;

  if (r.margin === 1) {
    return toNum(isHome ? r.home_1_12_odds : isAway ? r.away_1_12_odds : null);
  }
  if (r.margin === 13) {
    return toNum(isHome ? r.home_13_plus_odds : isAway ? r.away_13_plus_odds : null);
  }
  return null;
}

function computeExpectedOutcome(r: Row): string | null {
  if (!r.picked_team) return null;
  if (r.picked_team === "DRAW") return "draw";
  if (r.margin == null) return null;
  const isHome = r.picked_team === r.home_team_code;
  const isAway = r.picked_team === r.away_team_code;

  if (r.margin === 1) return isHome ? "home_1_12" : isAway ? "away_1_12" : null;
  if (r.margin === 13) return isHome ? "home_13_plus" : isAway ? "away_13_plus" : null;
  return null;
}

function deriveActualOutcome(
  winning_team: string | null,
  margin_band: string | null,
  home_team_code: string,
  away_team_code: string
): "draw" | "home_1_12" | "home_13_plus" | "away_1_12" | "away_13_plus" | null {
  if (winning_team == null) return null;
  if (winning_team === "DRAW") return "draw";
  if (winning_team === home_team_code) {
    if (margin_band === "1-12") return "home_1_12";
    if (margin_band === "13+") return "home_13_plus";
    return null;
  }
  if (winning_team === away_team_code) {
    if (margin_band === "1-12") return "away_1_12";
    if (margin_band === "13+") return "away_13_plus";
    return null;
  }
  return null;
}

function computeReturnProfit(
  r: Row
): { returnVal: number | null; profit: number | null; stakeNum: number | null } {
  if (!r.paper_bet_id) return { returnVal: null, profit: null, stakeNum: null };
  const stakeNum = toNum(r.stake);
  const oddsNum = computeExpectedOdds(r); // use live odds
  if (stakeNum == null || oddsNum == null) return { returnVal: null, profit: null, stakeNum };
  const actualOutcome = deriveActualOutcome(
    r.winning_team,
    r.margin_band,
    r.home_team_code,
    r.away_team_code
  );
  if (actualOutcome == null) return { returnVal: null, profit: null, stakeNum };
  const won = r.paper_outcome === actualOutcome;
  const returnVal = won ? stakeNum * oddsNum : 0;
  const profitVal = returnVal - stakeNum;
  return { returnVal, profit: profitVal, stakeNum };
}

export default async function AdminPaperBetsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; round?: string; participant?: string }>;
}) {
  const sp = await searchParams;
  const leagueId = sp.league ?? "";
  const roundId = sp.round ?? "";
  const participantId = sp.participant ?? "";

  const leaguesRes = await supabaseAdmin
    .from("leagues")
    .select("id, name")
    .order("created_at", { ascending: false });

  const leagues: League[] = (leaguesRes.data ?? []) as League[];

  const roundsRes = await supabaseAdmin
    .from("rounds")
    .select("id, season, round_number")
    .order("season", { ascending: false })
    .order("round_number", { ascending: true });

  const rounds: Round[] = (roundsRes.data ?? []) as Round[];

  const participantsRes = leagueId
    ? await supabaseAdmin
        .from("participants")
        .select("id, team_name")
        .eq("league_id", leagueId)
        .order("team_name", { ascending: true })
    : await supabaseAdmin
        .from("participants")
        .select("id, team_name")
        .order("created_at", { ascending: false })
        .limit(50);

  const participants: { id: string; team_name: string | null }[] =
    (participantsRes.data ?? []) as { id: string; team_name: string | null }[];

  const topErrors: string[] = [
    leaguesRes.error?.message,
    roundsRes.error?.message,
    participantsRes.error?.message,
  ].filter((m): m is string => !!m);

  let rows: Row[] = [];
  let loadError: string | null = null;

  if (roundId && participantId) {
    const fixturesRes = await supabaseAdmin
      .from("fixtures")
      .select("id, match_number, kickoff_at, home_team_code, away_team_code")
      .eq("round_id", roundId)
      .order("match_number", { ascending: true });

    if (fixturesRes.error) {
      loadError = fixturesRes.error.message;
    } else {
      const fixtures = (fixturesRes.data ?? []) as {
        id: string;
        match_number: number;
        kickoff_at: string | null;
        home_team_code: string;
        away_team_code: string;
      }[];
      const fixtureIds = fixtures.map((f) => f.id);

      const [oddsRes, picksRes, paperRes, resultsRes] = await Promise.all([
        supabaseAdmin
          .from("match_odds")
          .select(
            "fixture_id, home_1_12_odds, home_13_plus_odds, draw_odds, away_1_12_odds, away_13_plus_odds"
          )
          .in("fixture_id", fixtureIds),
        supabaseAdmin
          .from("picks")
          .select("fixture_id, picked_team, margin")
          .eq("participant_id", participantId)
          .in("fixture_id", fixtureIds),
        supabaseAdmin
          .from("paper_bets")
          .select("id, fixture_id, outcome, stake, odds")
          .eq("participant_id", participantId)
          .in("fixture_id", fixtureIds),
        supabaseAdmin
          .from("results")
          .select("fixture_id, winning_team, margin_band")
          .in("fixture_id", fixtureIds),
      ]);

      if (oddsRes.error) loadError = oddsRes.error.message;
      else if (picksRes.error) loadError = picksRes.error.message;
      else if (paperRes.error) loadError = paperRes.error.message;
      else if (resultsRes.error) loadError = resultsRes.error.message;

      const oddsByFixture = new Map(
        (oddsRes.data ?? []).map((o: { fixture_id: string }) => [o.fixture_id, o])
      );
      const picksByFixture = new Map(
        (picksRes.data ?? []).map((p: { fixture_id: string }) => [p.fixture_id, p])
      );
      const paperByFixture = new Map(
        (paperRes.data ?? []).map((b: { fixture_id: string }) => [b.fixture_id, b])
      );
      const resultsByFixture = new Map(
        (resultsRes.data ?? []).map((res: { fixture_id: string }) => [res.fixture_id, res])
      );

      rows = fixtures.map((f) => {
        const o = oddsByFixture.get(f.id) ?? {};
        const p = picksByFixture.get(f.id) ?? {};
        const b = paperByFixture.get(f.id) ?? {};
        const res = resultsByFixture.get(f.id) ?? {};
        const oRow = o as Record<string, unknown>;
        const pRow = p as Record<string, unknown>;
        const bRow = b as Record<string, unknown>;
        const resRow = res as Record<string, unknown>;

        return {
          match_number: f.match_number,
          fixture_id: f.id,
          kickoff_at: f.kickoff_at,
          home_team_code: f.home_team_code,
          away_team_code: f.away_team_code,

          picked_team: (pRow.picked_team as string) ?? null,
          margin: pRow.margin != null ? Number(pRow.margin) : null,

          paper_bet_id: (bRow.id as string) ?? null,
          paper_outcome: (bRow.outcome as string) ?? null,
          stake: bRow.stake != null ? String(bRow.stake) : null,
          paper_odds: bRow.odds != null ? String(bRow.odds) : null,

          winning_team: (resRow.winning_team as string) ?? null,
          margin_band: (resRow.margin_band as string) ?? null,

          home_1_12_odds: oRow.home_1_12_odds != null ? String(oRow.home_1_12_odds) : null,
          home_13_plus_odds: oRow.home_13_plus_odds != null ? String(oRow.home_13_plus_odds) : null,
          draw_odds: oRow.draw_odds != null ? String(oRow.draw_odds) : null,
          away_1_12_odds: oRow.away_1_12_odds != null ? String(oRow.away_1_12_odds) : null,
          away_13_plus_odds: oRow.away_13_plus_odds != null ? String(oRow.away_13_plus_odds) : null,
        };
      });
    }
  }

  const base = "/admin/paper-bets";

  return (
    <>
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">Paper Bets Results</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Per-fixture returns and ROI leaderboard for the selected round.
        </p>
      </header>

      {topErrors.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <b>Errors loading dropdown data:</b>
          <ul className="mt-2 list-inside list-disc pl-1">
            {topErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <form
          method="GET"
          action={base}
          className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        >
          <label className="grid gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">League</span>
            <select name="league" defaultValue={leagueId} className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              <option value="">Select…</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? l.id}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Round</span>
            <select name="round" defaultValue={roundId} className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              <option value="">Select…</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.season} · Round {r.round_number} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Participant</span>
            <select name="participant" defaultValue={participantId} className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              <option value="">Select…</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.team_name ?? p.id}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:border-zinc-600 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            Load
          </button>
        </form>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Tip: pick League first so the Participant dropdown is scoped.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <PaperBetsLeaderboardSection roundId={roundId} />
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <b>Error:</b> {loadError}
        </div>
      )}

      {roundId && participantId && !loadError && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {(() => {
            const totals = rows.reduce(
              (acc, r) => {
                const { returnVal, profit: prof, stakeNum } = computeReturnProfit(r);
                if (stakeNum != null) acc.staked += stakeNum;
                if (returnVal != null) acc.return += returnVal;
                if (prof != null) acc.profit += prof;
                return acc;
              },
              { staked: 0, return: 0, profit: 0 }
            );
            return (
              <>
                <table className="w-full border-collapse text-sm leading-5">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                      <th className="p-2">#</th>
                      <th className="p-2">Fixture</th>
                      <th className="whitespace-nowrap p-2">Kickoff</th>
                      <th className="p-2">Pick</th>
                      <th className="p-2">Paper Bet</th>
                      <th className="p-2 text-right whitespace-nowrap">Result</th>
                      <th className="p-2 text-right tabular-nums whitespace-nowrap">Return</th>
                      <th className="p-2 text-right tabular-nums whitespace-nowrap">Profit</th>
                      <th className="p-2 text-right whitespace-nowrap">Odds Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const expectedOdds = computeExpectedOdds(r);
                      const expectedOutcome = computeExpectedOutcome(r);
                      const savedOdds = toNum(r.paper_odds);
                      const oddsOk =
                        expectedOdds == null || savedOdds == null
                          ? false
                          : Math.abs(expectedOdds - savedOdds) < 1e-9;

                      const hasPick = !!r.picked_team && (r.picked_team === "DRAW" || r.margin != null);
                      const hasPaper = !!r.paper_bet_id;

                      const { returnVal, profit: profitVal } = computeReturnProfit(r);

                      let badge = "—";
                      if (!hasPick) badge = "NO PICK";
                      else if (hasPick && !hasPaper) badge = "MISSING PAPER BET";
                      else if (
                        hasPick &&
                        hasPaper &&
                        expectedOutcome &&
                        r.paper_outcome !== expectedOutcome
                      )
                        badge = "OUTCOME MISMATCH";
                      else if (
                        hasPick &&
                        hasPaper &&
                        expectedOdds != null &&
                        savedOdds != null &&
                        !oddsOk
                      )
                        badge = "ODDS MOVED";
                      else if (hasPick && hasPaper) badge = "OK";

                      const resultLabel =
                        returnVal == null && profitVal == null
                          ? "UNSETTLED"
                          : profitVal != null && profitVal >= 0
                            ? "WIN"
                            : "LOSS";
                      const resultPillClass =
                        resultLabel === "UNSETTLED"
                          ? "rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                          : resultLabel === "WIN"
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300";

                      return (
                        <tr key={r.fixture_id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                          <td className="whitespace-nowrap p-2 tabular-nums">{r.match_number}</td>
                          <td className="p-2">
                            <div className="font-semibold">
                              {r.home_team_code} vs {r.away_team_code}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-zinc-400">
                              {r.fixture_id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="whitespace-nowrap p-2 text-sm tabular-nums">
                            {fmtDate(r.kickoff_at)}
                          </td>
                          <td className="p-2">
                            {hasPick ? (
                              <>
                                <div>
                                  <b>{r.picked_team}</b> · margin {r.picked_team === "DRAW" ? "-" : r.margin}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-zinc-400">
                                  Expected: {expectedOutcome ?? "-"}
                                </div>
                              </>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="p-2">
                            {hasPaper ? (
                              <>
                                <div className="font-medium">{r.paper_outcome}</div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  stake {r.stake ?? "-"} · odds {r.paper_odds ?? "-"}
                                </div>
                              </>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            <span className={resultPillClass}>{resultLabel}</span>
                          </td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap">
                            {returnVal != null ? Number(returnVal).toFixed(1) : "—"}
                          </td>
                          <td className="p-2 text-right tabular-nums whitespace-nowrap">
                            {profitVal != null ? Number(profitVal).toFixed(1) : "—"}
                          </td>
                          <td className="p-2 text-right">
                            {badge === "OK" ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                OK
                              </span>
                            ) : (
                              <div className="font-semibold">{badge}</div>
                            )}
                            {(badge === "ODDS MOVED" || badge === "MISSING PAPER BET") &&
                              expectedOdds != null && (
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  Expected odds: {expectedOdds}
                                </div>
                              )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <td colSpan={6} className="p-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                        Total Staked: <span className="tabular-nums font-medium">{totals.staked.toFixed(1)}</span>
                      </td>
                      <td className="p-3 text-right text-sm tabular-nums">
                        Total Return: <span className="font-medium">{totals.return.toFixed(1)}</span>
                      </td>
                      <td className="p-3 text-right text-sm tabular-nums font-bold">
                        Total Profit: {totals.profit.toFixed(1)}
                      </td>
                      <td className="p-3" />
                    </tr>
                  </tfoot>
                </table>
              </>
            );
          })()}

          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            If you see <b>MISSING PAPER BET</b>, your sync didn’t run for this round/participant
            or there’s missing odds. If you see <b>ODDS MOVED</b>, the market price has changed
            since the paper bet was created.
          </p>
        </div>
      )}
    </>
  );
}
