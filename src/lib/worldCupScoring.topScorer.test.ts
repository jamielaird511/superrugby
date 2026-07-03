import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  officialTopScoringTeamCodesFromResult,
  scorePoolTopAttackingPick,
  WC_POOL_TOP_ATTACKING_POINTS,
} from "./worldCupScoring";

describe("pool top attacking / top scoring team", () => {
  const tiedTeams = ["FRA", "GER", "NED"];

  it("awards points when pick matches any official tied team", () => {
    assert.equal(scorePoolTopAttackingPick("FRA", tiedTeams), WC_POOL_TOP_ATTACKING_POINTS);
    assert.equal(scorePoolTopAttackingPick("GER", tiedTeams), WC_POOL_TOP_ATTACKING_POINTS);
    assert.equal(scorePoolTopAttackingPick("NED", tiedTeams), WC_POOL_TOP_ATTACKING_POINTS);
  });

  it("awards 0 when pick is not in the official array", () => {
    assert.equal(scorePoolTopAttackingPick("BRA", tiedTeams), 0);
    assert.equal(scorePoolTopAttackingPick("DRAW", tiedTeams), 0);
  });

  it("awards 0 for null or empty official result", () => {
    assert.equal(scorePoolTopAttackingPick("FRA", null), 0);
    assert.equal(scorePoolTopAttackingPick("FRA", []), 0);
    assert.equal(scorePoolTopAttackingPick("FRA", undefined), 0);
  });

  it("normalizes pick and result codes case-insensitively", () => {
    assert.equal(scorePoolTopAttackingPick("fra", ["FRA", "GER"]), WC_POOL_TOP_ATTACKING_POINTS);
    assert.equal(scorePoolTopAttackingPick("FRA", ["ger", "ned"]), 0);
  });

  it("resolves legacy single top_scoring_team_code during migration", () => {
    assert.deepEqual(
      officialTopScoringTeamCodesFromResult({ top_scoring_team_code: "FRA", top_scoring_team_codes: null }),
      ["FRA"]
    );
    assert.equal(
      scorePoolTopAttackingPick(
        "FRA",
        officialTopScoringTeamCodesFromResult({
          top_scoring_team_code: "FRA",
          top_scoring_team_codes: null,
        })
      ),
      WC_POOL_TOP_ATTACKING_POINTS
    );
  });

  it("prefers top_scoring_team_codes array over legacy single code", () => {
    assert.deepEqual(
      officialTopScoringTeamCodesFromResult({
        top_scoring_team_code: "BRA",
        top_scoring_team_codes: ["FRA", "GER", "NED"],
      }),
      ["FRA", "GER", "NED"]
    );
    assert.equal(scorePoolTopAttackingPick("BRA", ["FRA", "GER", "NED"]), 0);
  });
});
