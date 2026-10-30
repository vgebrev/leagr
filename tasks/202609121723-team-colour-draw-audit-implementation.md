# Team Colour Draw Audit + Colour Distribution Regression Test

## Overview

Audited team colour assignment for hidden bias after a report of long per-player colour
droughts and group folklore around a "blue curse". Found two historical shuffle defects
(both already fixed in `main`), confirmed the current implementation is sound, and replaced
the permanently-skipped colour test with a deterministic regression suite that actually
catches the defect that shipped.

## Findings

Colour assignment is one line, `teamGenerator.js:382`. It has had three implementations:

| Era                                    | Code                              | Sessions | index -> colour                                                |
| -------------------------------------- | --------------------------------- | -------- | -------------------------------------------------------------- |
| A (pre 2025-08-02)                     | `teamColours[i]`                  | 10       | Fixed identity: slot 0 always blue, 1 white, 2 orange, 3 green |
| B (2025-08-02 - 2026-04-18, `f586ba8`) | `sort(() => Math.random() - 0.5)` | 39       | Non-uniform                                                    |
| C (2026-04-19 - now, `ef776a1`)        | Fisher-Yates                      | 21       | Uniform                                                        |

Era B is the classic broken shuffle. Under V8 it returns the identity permutation ~18.8% of
the time and its reverse ~17.1%, against 4.17% for a fair shuffle. The pirates data matches
the predicted marginals: 44 identity-diagonal hits vs 33 expected, chi-square 25.1 (df 9,
p ~ 0.003). Era C tests clean (chi-square 11.6, df 9, p ~ 0.24).

**The bias never reached players.** Snake-draft position is randomised within each pot, so
player -> team-slot stayed uniform even while slot -> colour was not. Per-player colour counts
across all 70 sessions give a family-wise p of 0.56 over 45 regulars (2 of 45 below raw
p<0.05; 2.3 expected).

**Blue's poor record is not a draw artefact.** In era C blue finished last 12 times in 20
(5 expected), but draw-time team ELO is flat across colours, ELO rank barely predicts
finishing position (r = 0.09), leave-one-out roster-strength prediction is identical across
colours (blue 1.359 vs green 1.389 predicted ppg), home/away is exactly 60/60 per colour,
11 of 12 last places were clear rather than tie-breaks, and post-draw roster churn is not
blue-skewed. No mechanism exists in the code.

## Architecture decisions

- **Kept the static per-count palette.** `teamColours.slice(0, count)` means green requires
  4 teams and black requires 5. This is deliberate and retained: sessions are almost always
  4 teams, and a stable palette per team count is preferred over equal colour billing.
- **Test the shuffle's permutation distribution, not a single player's colour.** The old test
  sampled which colour one player (`Veli`) landed on. That statistic stays uniform even under
  the broken shuffle, because player -> slot is independently randomised, so the test could
  never have caught the era B defect regardless of runtime.
- **Determinism via seeded PRNG, not tolerance widening.** `Math.random` is stubbed with
  mulberry32 so chi-square values are fixed. Thresholds are the real df-appropriate critical
  values at p = 0.001 (49.73 for df 23, 27.88 for df 9) rather than arbitrary slack.
- **Stub the noun pool.** `getNextNouns` is file-backed and irrelevant to colour; mocking it
  keeps the test in-memory.

## Files modified

- `test/lib/server/teamGenerator.colour.test.js` - replaced the single `it.skip` test with
  three deterministic tests: palette correctness for 3/4/5 teams, permutation uniformity over
  all 24 orderings, and slot x colour marginal uniformity.

No production code was changed; the current implementation is already correct.

## Testing approach

Verified the new suite fails against the historical defect by temporarily reinstating
`sort(() => Math.random() - 0.5)`: permutation uniformity scored chi-square 13,550 against a
49.73 threshold, marginals 5,962 against 27.88. Both guards fire decisively. Restored, the
suite passes in ~120ms. Full backend suite: 41 files, 1348 passed, 1 skipped (the pre-existing
`SMOKE=1` manual test).

## Assumptions and limitations

- Statistics are drawn from the `pirates` league only (70 sessions with teams, 2025-05-24 to
  2026-09-12); other leagues have too little history.
- The era C blue result is significant at family-wise p = 0.0037, but blue was flagged by
  folklore before analysis and the era window was chosen post hoc from a code-change boundary.
  Accounting for that selection puts it nearer p ~ 0.01 - an unlikely run, not evidence of a
  mechanism.
- The tests assert distributional properties of `Math.random`-driven shuffling. They are
  deterministic only because the PRNG is stubbed; the seeds must not be changed casually, as
  the asserted chi-square values are seed-specific.
