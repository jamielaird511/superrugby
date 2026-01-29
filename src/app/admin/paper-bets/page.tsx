import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

      const [oddsRes, picksRes, paperRes] = await Promise.all([
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
      ]);

      if (oddsRes.error) loadError = oddsRes.error.message;
      else if (picksRes.error) loadError = picksRes.error.message;
      else if (paperRes.error) loadError = paperRes.error.message;

      const oddsByFixture = new Map(
        (oddsRes.data ?? []).map((o: { fixture_id: string }) => [o.fixture_id, o])
      );
      const picksByFixture = new Map(
        (picksRes.data ?? []).map((p: { fixture_id: string }) => [p.fixture_id, p])
      );
      const paperByFixture = new Map(
        (paperRes.data ?? []).map((b: { fixture_id: string }) => [b.fixture_id, b])
      );

      rows = fixtures.map((f) => {
        const o = oddsByFixture.get(f.id) ?? {};
        const p = picksByFixture.get(f.id) ?? {};
        const b = paperByFixture.get(f.id) ?? {};
        const oRow = o as Record<string, unknown>;
        const pRow = p as Record<string, unknown>;
        const bRow = b as Record<string, unknown>;

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
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Paper Bets Results</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>
            Eyeball paper_bets vs picks vs odds for a participant in a round.
          </p>
        </div>
        <Link href="/admin" style={{ textDecoration: "underline" }}>
          Back to Admin
        </Link>
      </div>

      {topErrors.length > 0 && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px solid #ef4444",
            borderRadius: 10,
          }}
        >
          <b>Errors loading dropdown data:</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {topErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 10,
        }}
      >
        <form
          method="GET"
          action={base}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>League</span>
            <select name="league" defaultValue={leagueId} style={{ padding: 8 }}>
              <option value="">Select…</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name ?? l.id}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Round</span>
            <select name="round" defaultValue={roundId} style={{ padding: 8 }}>
              <option value="">Select…</option>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.season} · Round {r.round_number} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Participant</span>
            <select name="participant" defaultValue={participantId} style={{ padding: 8 }}>
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
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              height: 40,
            }}
          >
            Load
          </button>
        </form>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Tip: pick League first so the Participant dropdown is scoped.
        </div>
      </div>

      {loadError && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px solid #ef4444",
            borderRadius: 10,
          }}
        >
          <b>Error:</b> {loadError}
        </div>
      )}

      {roundId && participantId && !loadError && (
        <div style={{ marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px" }}>#</th>
                <th style={{ padding: "10px 8px" }}>Fixture</th>
                <th style={{ padding: "10px 8px" }}>Kickoff</th>
                <th style={{ padding: "10px 8px" }}>Pick</th>
                <th style={{ padding: "10px 8px" }}>Paper Bet</th>
                <th style={{ padding: "10px 8px" }}>Odds Check</th>
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
                  badge = "ODDS MISMATCH";
                else if (hasPick && hasPaper) badge = "OK";

                return (
                  <tr key={r.fixture_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      {r.match_number}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {r.home_team_code} vs {r.away_team_code}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {r.fixture_id.slice(0, 8)}
                      </div>
                    </td>
                    <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                      {fmtDate(r.kickoff_at)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {hasPick ? (
                        <>
                          <div>
                            <b>{r.picked_team}</b> · margin {r.picked_team === "DRAW" ? "-" : r.margin}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Expected: {expectedOutcome ?? "-"}
                          </div>
                        </>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {hasPaper ? (
                        <>
                          <div>
                            <b>{r.paper_outcome}</b>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            stake {r.stake ?? "-"} · odds {r.paper_odds ?? "-"}
                          </div>
                        </>
                      ) : (
                        <span style={{ opacity: 0.6 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 700 }}>{badge}</div>
                      {(badge === "ODDS MISMATCH" || badge === "MISSING PAPER BET") &&
                        expectedOdds != null && (
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Expected odds: {expectedOdds}
                          </div>
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            If you see <b>MISSING PAPER BET</b>, your sync didn’t run for this round/participant
            or there’s missing odds. If you see <b>ODDS/OUTCOME MISMATCH</b>, your mapping logic
            is wrong.
          </div>
        </div>
      )}
    </div>
  );
}
