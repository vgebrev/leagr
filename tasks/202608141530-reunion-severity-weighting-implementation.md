# Reunion Severity Weighting — Telling a 25-Session Drought From a 12-Session One

**Date:** 2026-08-14

## Overview

The [reunion norm retune](202608141220-reunion-norm-retune-implementation.md) earlier today
(`W_REUNION` 0.4 → 2.0) took Dan & Veli from never being drawn together to most draws, but
not all of them: **33/40 on 2026-08-15 and 29/40 on 2026-08-01**. The misses were not
random — they were the constrained draws where the hard ELO cap prevents satisfying every
attending overdue pair and the optimizer must pick which reunion to buy.

That retune explicitly deferred the reason it picks badly: _"the norm cannot express 'Dan &
Veli is far more overdue than Brent & Veli' — every one is fungible."_ This change fixes
that and nothing else. `W_REUNION` is untouched.

## Root cause: the severity fields are saturated

`coAttendance` and `probNone` are both clamped by `coAttendanceLimit: 15`, so pairs with
very different droughts record **identically**:

```
Jonathen & Xavier   coAtt=15  probNone=0.02538  -ln=3.67     true drought: 15 co-attendances
Dan & Veli          coAtt=15  probNone=0.02538  -ln=3.67     true drought: 25
Irry & Tinashe      coAtt=12  probNone=0.04280  -ln=3.15     true drought: 12
Brent & Veli        coAtt=12  probNone=0.04751  -ln=3.05     true drought: 12
```

The resulting credit shares were a near-tie — **Dan 37% / Irry 32% / Brent 31%** on
2026-08-15, and **28 / 26 / 24 / 23%** on 2026-08-01 — so the tiebreak fell through to ELO
cost, and the pair involving the 331-point outlier always lost it.

`sessionsSinceLastPairing` is the wrong axis to fix this on: it ties Dan & Veli with Brent &
Veli at 46 sessions despite one having twice the co-attendances.

## Changes

### 1. Uncapped drought track — `teammateHistory.js` (`computeOverduePairs`)

A second evidence track (`droughtCoAttendance` / `droughtProbNone`) accrues past
`coAttendanceLimit`, bounded only by the session lookback. The capped fields keep identical
semantics, so **which pairs qualify does not change** — verified against all three live
sessions, same 4 pairs with identical `coAttendance`/`probNone`.

The load-bearing detail: a pairing found beyond the cap closes the _drought_ but must **not**
set `paired`. That is what keeps Jonathen & Xavier (last paired at co-attendance 16) in the
overdue set while still recording their real drought as 15. Getting this wrong silently
shrinks the overdue set — the same failure mode as naively uncapping `coAttendanceLimit`.

### 2. Severity-weighted credit — `teamGenerator.js` (`calculateReunionScoreNormalized`)

```js
const SEVERITY_EXPONENT = 1.25;
...
const p = droughtProbNone ?? probNone;
const weight = p > 0 && p < 1 ? Math.pow(-Math.log(p), SEVERITY_EXPONENT) : 1;
```

The `?? probNone` fallback keeps hand-built overdue records working unchanged.

### 3. Draw log shows the drought

```
[teams] reunion: 3 overdue pair(s) attending (Dan&Veli(25), Irry&Tinashe(12), Brent&Veli(12)) | score=0.00
```

## Choosing the exponent

**The enumeration sweep used for `W_REUNION` was the wrong instrument here** and initially
gave a misleading answer. At 12k sampled candidates it looked like the capped weighting
dropped Dan & Veli; at 17k candidates a draw satisfying _all four_ pairs exists and wins
under every scheme, capped included. The global argmin does not discriminate — the
discrimination lives in the **5000-iteration random search with early stopping**, which is
what actually ships and what produces the misses.

Swept against the real generator, 40 draws per cell:

| 2026-08-01     | Dan & Veli | Offie & Talent | Chris & Talent | Brent & Veli | eloΔ avg |
| -------------- | ---------- | -------------- | -------------- | ------------ | -------- |
| capped (today) | 29/40      | 39/40          | 40/40          | 40/40        | 56.9     |
| e = 1.0        | 35/40      | 37/40          | 38/40          | 38/40        | 60.5     |
| **e = 1.25**   | **40/40**  | 39/40          | 36/40          | 39/40        | 63.3     |
| e = 1.5        | 40/40      | 39/40          | 37/40          | **34/40**    | 65.4     |
| e = 2.0        | 40/40      | 37/40          | **35/40**      | 37/40        | 61.9     |

Raising the exponent trades mild-pair service for starved-pair service. 1.0 under-serves
Dan & Veli; 1.5 and above start visibly starving the mild pairs in turn (and e=1.5 pushed
one draw to eloΔ 100.3 against a 102 cap). **1.25** is the balance point.

## Results

40 draws per session, shipped constant:

| Session    | pair           | before | after     | eloΔ avg  | eloΔ max / limit |
| ---------- | -------------- | ------ | --------- | --------- | ---------------- |
| 2026-08-15 | **Dan & Veli** | 33/40  | **40/40** | 63.5→68.1 | 86.9 / 98        |
|            | Irry & Tinashe | 40/40  | 40/40     |           |                  |
|            | Brent & Veli   | 39/40  | 36/40     |           |                  |
| 2026-08-01 | **Dan & Veli** | 29/40  | **40/40** | 56.9→63.3 | 84.9 / 102       |
|            | Offie & Talent | 39/40  | 39/40     |           |                  |
|            | Chris & Talent | 40/40  | 36/40     |           |                  |
|            | Brent & Veli   | 40/40  | 39/40     |           |                  |
| 2026-08-08 | Offie & Talent | 40/40  | 40/40     | 18.2→16.4 | 33.7 / 60        |

Full suite: **930 backend + 186 frontend** pass; `npm run lint` clean.

## Testing

- `teammateHistory.test.js` — drought runs past the cap while `coAttendance` saturates; a
  pairing beyond the cap closes the drought without clearing the debt (the Jonathen & Xavier
  guard).
- `teamGenerator.reunion.test.js` — one severely starved reunion outranks two mild ones,
  using the live pirates values. **Verified to fail against the capped weighting** (scores
  invert: 0.628 vs 0.372), so it is not vacuous. Plus a fallback guard for records with no
  drought evidence.

## Assumptions & limitations

- **Mild pairs are served slightly less often**: 39→36/40 and 40→36/40 in the tables above,
  i.e. ~90% instead of ~100%. This is the intended direction (agreed with the user: severity
  sets priority when not everything fits, it never switches a pair off) but it is a real
  cost, not zero. Run-to-run noise on these counts is roughly ±4/40, so the mild-pair dips
  sit close to the noise floor while the Dan & Veli gains (+7 and +11) are well outside it.
- **Average eloΔ rises ~5-6 points on contested weeks.** `W_REUNION` is unchanged; the rise
  is the direct cost of actually buying the expensive reunion more often. All draws stay
  inside `hardEloDeltaLimit`.
- **Drought is censored by the 40-session lookback.** Dan & Veli read 25 against a true 26
  because their last pairing (2025-09-27) sits outside the window. Two pairs whose droughts
  both exceed the lookback are indistinguishable. Only Dan & Veli are censored today; if
  more pairs reach that bound, the lookback — not the exponent — is the knob to revisit.
- **`SEVERITY_EXPONENT` is tuned to the current overdue list (4 pairs, droughts 12-25).**
  Re-sweep if the spread of droughts changes materially.
- Verification used a scratch replay runner, not
  `test/manual/reunionNorm.smoke.test.js`, which still throws "Not enough players" on
  sessions that were not full (pre-existing harness quirk, see the previous task doc).
