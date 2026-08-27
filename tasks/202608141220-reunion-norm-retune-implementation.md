# Reunion Norm Retune — Making Overdue Pairs Actually Fire

**Date:** 2026-08-14

## Overview

The reunion norm shipped in `58d4655` (see
[202607021830-reunion-norm-implementation.md](202607021830-reunion-norm-implementation.md))
was reuniting overdue pairs, but never the pair it was built for. Dan & Veli had not shared
a team since **2025-09-27 — 46 sessions and 26 co-attendances ago** — and across ~10
production-data draw attempts on 2026-08-14 they were not paired once.

Reproducing on the 2026-08-15 session (24 players, 4×6), 20 replays:

```
WITH reunion norm: Irry&Tinashe ×14, Brent&Veli ×10, Dan&Veli ×0
BASELINE (no norm): Irry&Tinashe ×6,  Brent&Veli ×5,  Dan&Veli ×0
```

The norm was firing — it just always bought the cheap reunions and never the expensive one.

## Root cause

`W_REUNION = 0.4` against a denominator of 5.1 (`W_ELO 1.0 + W_PAIR 1.3 + W_ATTACK 0.8 +
W_CONTROL 0.8 + W_TRAITS 0.8`). The entire reunion signal — "none reunited" to "all
reunited" — was worth **7.8% of `totalNorm`**.

Dan is a 331-point ELO outlier (1503.6 vs Veli 1172.5; the #2 player overall is Bobinho at
1177). Both land in pot 0. Pairing them is legal — each team takes 2 players per pot — but
it widens `eloDelta` and `attackDelta` sharply, and that cost exceeded the entire reunion
budget. Because credit is fractional and the `-ln(probNone)` weights are compressed into
3.05–3.67, every starved pair is roughly fungible, so the optimizer harvested the cheap
reunions and left the expensive one permanently unpaid.

Weight sweep over 30 000 enumerated candidate draws for 2026-08-15, taking the argmin under
each weight:

| `W_REUNION`   | eloΔ  | atkΔ  | reunited                               |
| ------------- | ----- | ----- | -------------------------------------- |
| 0.4 (old)     | 58/98 | 0.049 | Brent&Veli only                        |
| 1.0           | 58/98 | 0.049 | Brent&Veli only                        |
| **1.5 – 3.0** | 73/98 | 0.168 | **Dan&Veli, Irry&Tinashe, Brent&Veli** |

The decision flips at 1.5 and then plateaus, so **2.0** was chosen — mid-plateau, robust to
week-to-week variation in the candidate pool.

## Changes

### 1. `W_REUNION` 0.4 → 2.0 (`teamGenerator.js:824`)

The conditional gate is unchanged: when no overdue pair attends, `W_REUNION` is 0 and
scores stay bit-identical to before.

### 2. Draw logging described teams that were thrown away (bug)

`bestMetrics` was captured inside the search loop (`:1313`), then `bestTeams` was
**replaced** by `optimizeTeamsWithSwaps` (`:1371`), then `logDrawInfo` was called with the
stale metrics. Every `score=`, `elo=`, `pair=` and `reunion score=` in `logs/app.log`
described the pre-swap candidate, not the teams saved.

Observed on 2026-08-14: a draw logged `reunion: … score=1.00 (0=all reunited, 1=none)`
while its saved teams had Irry and Tinashe together — true score 0.681. This is what made
the log misleading to read while diagnosing the original problem.

Fixed by re-scoring `bestTeams` after the optimizer returns.

### 3. Draw log line now carries the norms that mattered

It printed only `pair=` and `spread=` (dead — `W_SPREAD` is 0). `reunion=`, `atk=`, `ctl=`
and `traits=` were computed but never logged, which is why diagnosing this needed an
experiment rather than a log read. `spread=` dropped.

```
[teams] seeded 24p → 4×6 | 2584/5000 iter | rejects: … | best: score=0.370
        elo=44pts(limit 98) pair=0.17 reunion=0.63 atk=0.05 ctl=0.01 traits=0.18 | fallback=false
```

## Files modified

- `src/lib/server/teamGenerator.js` — `W_REUNION` 0.4 → 2.0; re-score after
  `optimizeTeamsWithSwaps`; expanded `logDrawInfo` main line.
- `test/lib/server/teamGenerator.reunion.test.js` — two new cases.

## Testing

Existing reunion tests assert relationships rather than absolute weights, so the retune did
not break them. Two new cases, both verified to fail against the pre-fix code:

- _prefers a reunited draw over a better-balanced split draw_ — the reunion costs ~0.5 of
  `eloNorm`, which outvoted it at `W_REUNION = 0.4`. Fails if the weight is lowered again.
- _re-scores after swap optimization so the reunion score is not stale_ — stubs
  `optimizeTeamsWithSwaps` to return a layout the snake draft can never produce (all four
  top seeds on one team), so the pre-swap metrics necessarily differ, then asserts the
  logged metrics match the returned teams.

Full suite: **926 backend + 186 frontend** pass; `npm run lint` clean.

### Real-data verification

20 replayed draws per session (`test/manual/reunionNorm.smoke.test.js` and an equivalent
runner for sessions with ragged team sizes), replaying the real `pirates` history:

| Session    | pair           | before | after     | eloΔ avg (baseline) | eloΔ max / limit |
| ---------- | -------------- | ------ | --------- | ------------------- | ---------------- |
| 2026-08-15 | **Dan & Veli** | 0/20   | **16/20** | 67.3 (44.3)         | 90.7 / 98        |
|            | Irry & Tinashe | 14/20  | 20/20     |                     |                  |
|            | Brent & Veli   | 10/20  | 20/20     |                     |                  |
| 2026-08-01 | **Dan & Veli** | 0/20   | **13/20** | 58.4 (28.2)         | 83.6 / 102       |
|            | Chris & Talent | 2/20   | 20/20     |                     |                  |
|            | Offie & Talent | 9/20   | 19/20     |                     |                  |
|            | Brent & Veli   | 6/20   | 20/20     |                     |                  |
| 2026-08-08 | Offie & Talent | 9/20   | 20/20     | 18.6 (14.7)         | 38.8 / 60        |

## Assumptions & limitations

- **Teams are measurably less balanced on weeks with attending overdue pairs** — average
  eloΔ roughly doubles (28→58 on 2026-08-01). This is the accepted trade-off, agreed before
  implementation. All draws stay inside the existing `hardEloDeltaLimit`, which was not
  touched. Weeks with no attending overdue pair are unaffected.
- **Do not "just uncap" the evidence window.** Relaxing `coAttendanceLimit` to `null` with a
  65-session lookback removes Dan & Veli from the overdue set entirely: `computeOverduePairs`
  sets `paired = true` on the first pairing it reaches
  ([`teammateHistory.js:228`](../src/lib/server/teammateHistory.js)) and they did pair on
  2025-09-27. The 40-session / 15-co-attendance bounds are precisely what keeps chronic
  pairs flagged. Measured, not assumed.
- ~~**No debt escalation was added.**~~ `probNone` floors at ~0.025 (the
  `coAttendanceLimit: 15` cap) and `alpha` caps the other end, so weights compress into
  3.05–3.67 and the norm cannot express "Dan & Veli is far more overdue than Brent & Veli".
  ~~At `W_REUNION = 2.0` the generator satisfies every attending pair, so there is nothing
  for a priority order to resolve.~~ It does not: the 16/20 and 13/20 figures below are
  exactly the constrained draws where it must choose and cannot. **Addressed 2026-08-14** by
  weighting credit on an uncapped drought measure — see
  [202608141530-reunion-severity-weighting-implementation.md](202608141530-reunion-severity-weighting-implementation.md).
- `test/manual/reunionNorm.smoke.test.js` derives `teamSizes` from saved team lengths
  including empty slots, so it throws "Not enough players" on sessions that were not full
  (e.g. 2026-08-08, 21 players in 24 slots). Pre-existing harness quirk, unrelated to this
  change.
- **`TeammateHistoryTracker` ignores `DATA_DIR`** — `teammateHistory.js:12` hardcodes
  `this.leagueDataPath = 'data'`, as does `league.js:124`, while `nounPool.js:6` honours
  `process.env.DATA_DIR`. Harmless today (the container mounts its volume at the default
  `./data` and does not set `DATA_DIR`), but it means smoke runs cannot be isolated by
  pointing `DATA_DIR` at a copy — they always read the real league directory. Noted, not
  fixed here.
